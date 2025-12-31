import { prisma } from "./prisma";

// =============================================================================
// LEGACY SETTINGS (for backward compatibility)
// =============================================================================

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// =============================================================================
// LEGACY TRANSACTIONS (for backward compatibility)
// =============================================================================

export interface DbTransaction {
  id: string;
  time: number;
  description: string;
  mcc: number;
  amount: number;
  balance: number;
  cashback_amount: number;
  comment: string | null;
}

export async function saveTransactions(transactions: DbTransaction[]): Promise<void> {
  await prisma.$transaction(
    transactions.map((tx) =>
      prisma.transaction.upsert({
        where: { id: tx.id },
        update: {
          time: tx.time,
          description: tx.description,
          mcc: tx.mcc,
          amount: tx.amount,
          balance: tx.balance,
          cashbackAmount: tx.cashback_amount,
          comment: tx.comment,
        },
        create: {
          id: tx.id,
          time: tx.time,
          description: tx.description,
          mcc: tx.mcc,
          amount: tx.amount,
          balance: tx.balance,
          cashbackAmount: tx.cashback_amount,
          comment: tx.comment,
        },
      })
    )
  );
}

export async function getTransactions(
  fromTime?: number,
  toTime?: number
): Promise<DbTransaction[]> {
  const where: { time?: { gte?: number; lte?: number } } = {};
  if (fromTime !== undefined || toTime !== undefined) {
    where.time = {};
    if (fromTime !== undefined) where.time.gte = fromTime;
    if (toTime !== undefined) where.time.lte = toTime;
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { time: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    time: r.time,
    description: r.description,
    mcc: r.mcc,
    amount: r.amount,
    balance: r.balance,
    cashback_amount: r.cashbackAmount,
    comment: r.comment,
  }));
}

export async function getAllTransactions(): Promise<DbTransaction[]> {
  return getTransactions();
}

// =============================================================================
// LEGACY EXCLUDED TRANSACTIONS
// =============================================================================

export async function getExcludedTransactionIds(): Promise<string[]> {
  const rows = await prisma.excludedTransaction.findMany();
  return rows.map((r) => r.id);
}

export async function addExcludedTransaction(id: string): Promise<void> {
  await prisma.excludedTransaction.upsert({
    where: { id },
    update: {},
    create: { id },
  });
}

export async function removeExcludedTransaction(id: string): Promise<void> {
  await prisma.excludedTransaction.deleteMany({ where: { id } });
}

export async function clearExcludedTransactions(): Promise<void> {
  await prisma.excludedTransaction.deleteMany();
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: number;
  updated_at: number;
  totp_enabled: boolean;
  totp_secret: string | null;
  backup_codes: string | null;
  reset_token_expiry: number | null;
}

export async function createUser(
  id: string,
  email: string,
  passwordHash: string,
  passwordSalt: string
): Promise<DbUser> {
  const user = await prisma.user.create({
    data: {
      id,
      email,
      passwordHash,
      passwordSalt,
    },
  });

  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: Math.floor(user.createdAt.getTime() / 1000),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
    totp_enabled: user.totpEnabled,
    totp_secret: user.totpSecret,
    backup_codes: user.backupCodes,
    reset_token_expiry: user.resetTokenExpiry ? Math.floor(user.resetTokenExpiry.getTime() / 1000) : null,
  };
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: Math.floor(user.createdAt.getTime() / 1000),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
    totp_enabled: user.totpEnabled,
    totp_secret: user.totpSecret,
    backup_codes: user.backupCodes,
    reset_token_expiry: user.resetTokenExpiry ? Math.floor(user.resetTokenExpiry.getTime() / 1000) : null,
  };
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: Math.floor(user.createdAt.getTime() / 1000),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
    totp_enabled: user.totpEnabled,
    totp_secret: user.totpSecret,
    backup_codes: user.backupCodes,
    reset_token_expiry: user.resetTokenExpiry ? Math.floor(user.resetTokenExpiry.getTime() / 1000) : null,
  };
}

// =============================================================================
// 2FA MANAGEMENT
// =============================================================================

export async function enableUserTotp(
  userId: string,
  encryptedSecret: string,
  encryptedBackupCodes: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: encryptedSecret,
      totpEnabled: true,
      backupCodes: encryptedBackupCodes,
    },
  });
}

export async function disableUserTotp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
      backupCodes: null,
    },
  });
}

export async function updateUserBackupCodes(
  userId: string,
  encryptedBackupCodes: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { backupCodes: encryptedBackupCodes },
  });
}

// =============================================================================
// PASSWORD RESET
// =============================================================================

export async function setUserResetToken(
  userId: string,
  token: string,
  expiryDate: Date
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetToken: token,
      resetTokenExpiry: expiryDate,
    },
  });
}

export async function getUserByResetToken(token: string): Promise<DbUser | null> {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user) return null;

  // Check if token is expired
  if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: Math.floor(user.createdAt.getTime() / 1000),
    updated_at: Math.floor(user.updatedAt.getTime() / 1000),
    totp_enabled: user.totpEnabled,
    totp_secret: user.totpSecret,
    backup_codes: user.backupCodes,
    reset_token_expiry: user.resetTokenExpiry ? Math.floor(user.resetTokenExpiry.getTime() / 1000) : null,
  };
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  passwordSalt: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordSalt,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
}

export async function clearUserResetToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
}

// =============================================================================
// PER-USER SETTINGS
// =============================================================================

export async function getUserSetting(
  userId: string,
  key: string
): Promise<string | null> {
  const row = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key } },
  });
  return row?.value ?? null;
}

export async function setUserSetting(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  });
}

export async function getAllUserSettings(
  userId: string
): Promise<Record<string, string>> {
  const rows = await prisma.userSetting.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function deleteUserSetting(
  userId: string,
  key: string
): Promise<void> {
  await prisma.userSetting.deleteMany({ where: { userId, key } });
}

// =============================================================================
// PER-USER TRANSACTIONS
// =============================================================================

export interface DbUserTransaction {
  id: string;
  user_id: string;
  time: number;
  description: string;
  mcc: number;
  amount: number;
  balance: number;
  cashback_amount: number;
  currency_code: number;
  comment: string | null;
}

export async function saveUserTransactions(
  userId: string,
  transactions: Omit<DbUserTransaction, "user_id">[]
): Promise<void> {
  // Ensure user exists (create placeholder if not)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `user_${userId}@placeholder.local`,
      passwordHash: "",
      passwordSalt: "",
    },
  });

  await prisma.$transaction(
    transactions.map((tx) =>
      prisma.userTransaction.upsert({
        where: { id: tx.id },
        update: {
          time: tx.time,
          description: tx.description,
          mcc: tx.mcc,
          amount: tx.amount,
          balance: tx.balance,
          cashbackAmount: tx.cashback_amount,
          currencyCode: tx.currency_code,
          comment: tx.comment,
        },
        create: {
          id: tx.id,
          userId,
          time: tx.time,
          description: tx.description,
          mcc: tx.mcc,
          amount: tx.amount,
          balance: tx.balance,
          cashbackAmount: tx.cashback_amount,
          currencyCode: tx.currency_code,
          comment: tx.comment,
        },
      })
    )
  );
}

export async function getUserTransactions(
  userId: string,
  fromTime?: number,
  toTime?: number
): Promise<DbUserTransaction[]> {
  const where: {
    userId: string;
    time?: { gte?: number; lte?: number };
  } = { userId };

  if (fromTime !== undefined || toTime !== undefined) {
    where.time = {};
    if (fromTime !== undefined) where.time.gte = fromTime;
    if (toTime !== undefined) where.time.lte = toTime;
  }

  const rows = await prisma.userTransaction.findMany({
    where,
    orderBy: { time: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    user_id: r.userId,
    time: r.time,
    description: r.description,
    mcc: r.mcc,
    amount: r.amount,
    balance: r.balance,
    cashback_amount: r.cashbackAmount,
    currency_code: r.currencyCode,
    comment: r.comment,
  }));
}

export async function getAllUserTransactions(
  userId: string
): Promise<DbUserTransaction[]> {
  return getUserTransactions(userId);
}

export async function deleteUserTransactionsAfter(
  userId: string,
  timestamp: number
): Promise<void> {
  await prisma.userTransaction.deleteMany({
    where: { userId, time: { gte: timestamp } },
  });
}

// =============================================================================
// PER-USER EXCLUDED TRANSACTIONS
// =============================================================================

export async function getUserExcludedTransactionIds(
  userId: string
): Promise<string[]> {
  const rows = await prisma.userExcludedTransaction.findMany({
    where: { userId },
  });
  return rows.map((r) => r.id);
}

export async function addUserExcludedTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  await prisma.userExcludedTransaction.upsert({
    where: { id_userId: { id: transactionId, userId } },
    update: {},
    create: { id: transactionId, userId },
  });
}

export async function removeUserExcludedTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  await prisma.userExcludedTransaction.deleteMany({
    where: { id: transactionId, userId },
  });
}

export async function clearUserExcludedTransactions(
  userId: string
): Promise<void> {
  await prisma.userExcludedTransaction.deleteMany({ where: { userId } });
}
