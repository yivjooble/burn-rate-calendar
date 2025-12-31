import { z } from "zod";

// =============================================================================
// SETTINGS VALIDATION
// =============================================================================

export const settingKeySchema = z.enum([
  "monoToken",
  "monthlyBudget",
  "accountId",
  "selectedAccountIds",
  "selectedAccountCurrencies",
  "lastSyncTime",
  "historicalDataLoaded",
]);

export const setSettingSchema = z.object({
  key: settingKeySchema,
  value: z.string().max(10000, "Value too long"),
});

export type SetSettingInput = z.infer<typeof setSettingSchema>;

// =============================================================================
// TRANSACTION VALIDATION
// =============================================================================

export const transactionSchema = z.object({
  id: z.string().min(1).max(100),
  time: z.number().int().positive(),
  description: z.string().max(1000),
  mcc: z.number().int().min(0).max(9999),
  amount: z.number().int(),
  balance: z.number().int(),
  cashbackAmount: z.number().int().optional().default(0),
  currencyCode: z.number().int().min(0).max(999).optional().default(980),
  comment: z.string().max(1000).nullable().optional(),
});

export const saveTransactionsSchema = z.object({
  transactions: z.array(transactionSchema).max(10000, "Too many transactions"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type SaveTransactionsInput = z.infer<typeof saveTransactionsSchema>;

// =============================================================================
// EXCLUDED TRANSACTION VALIDATION
// =============================================================================

export const excludedTransactionSchema = z.object({
  id: z.string().min(1).max(100),
  action: z.enum(["add", "remove"]).optional(),
});

export type ExcludedTransactionInput = z.infer<typeof excludedTransactionSchema>;

// =============================================================================
// HISTORICAL DATA VALIDATION
// =============================================================================

export const historicalMetaSchema = z.object({
  lastSyncTime: z.number().int().positive().nullable().optional(),
  historicalDataLoaded: z.boolean().optional(),
  historicalFromTime: z.number().int().positive().nullable().optional(),
  historicalToTime: z.number().int().positive().nullable().optional(),
});

export const historicalTransactionsSchema = z.array(transactionSchema).max(100000);

export type HistoricalMetaInput = z.infer<typeof historicalMetaSchema>;

// =============================================================================
// MONOBANK API VALIDATION
// =============================================================================

export const monoStatementQuerySchema = z.object({
  account: z.string().min(1).max(100).optional().default("0"),
  from: z.string().regex(/^\d+$/, "Must be a Unix timestamp"),
  to: z.string().regex(/^\d+$/, "Must be a Unix timestamp").optional(),
  currencyCode: z.string().regex(/^\d+$/, "Must be a currency code").optional(),
});

export type MonoStatementQuery = z.infer<typeof monoStatementQuerySchema>;

// =============================================================================
// AUTH VALIDATION
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Strong password requirements for registration
export const strongPasswordSchema = z
  .string()
  .min(12, "Пароль повинен містити мінімум 12 символів")
  .max(128, "Пароль занадто довгий")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Пароль повинен містити хоча б одну велику літеру (A-Z)",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Пароль повинен містити хоча б одну малу літеру (a-z)",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Пароль повинен містити хоча б одну цифру (0-9)",
  })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), {
    message: "Пароль повинен містити хоча б один спецсимвол (!@#$%...)",
  });

export const registerSchema = z.object({
  email: z.string().email("Невірний формат email").max(255),
  password: strongPasswordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Password strength checker for UI
export function getPasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
} {
  const checks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  const labels = ["Дуже слабкий", "Слабкий", "Середній", "Сильний", "Дуже сильний"];

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    checks,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate input and return parsed data or throw an error with details.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`
    );
    throw new ValidationError(errors.join("; "));
  }
  
  return result.data;
}

/**
 * Custom validation error class.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
