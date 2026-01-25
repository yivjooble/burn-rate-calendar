import { Transaction, MonoClientInfo } from "@/types";

const MONO_API_BASE = "https://api.monobank.ua";

export async function getClientInfo(token: string): Promise<MonoClientInfo> {
  const response = await fetch(`${MONO_API_BASE}/personal/client-info`, {
    headers: {
      "X-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Monobank API error: ${response.status}`);
  }

  return response.json();
}

export async function getStatement(
  token: string,
  accountId: string,
  from: number,
  to?: number
): Promise<Transaction[]> {
  const toTime = to || Math.floor(Date.now() / 1000);
  const url = `${MONO_API_BASE}/personal/statement/${accountId}/${from}/${toTime}`;

  const response = await fetch(url, {
    headers: {
      "X-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Monobank API error: ${response.status}`);
  }

  return response.json();
}

export function getMonthBoundaries(date: Date = new Date()): {
  from: number;
  to: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 23, 59, 59);

  return {
    from: Math.floor(firstDay.getTime() / 1000),
    to: Math.floor(lastDay.getTime() / 1000),
  };
}

// Financial month helper functions
export function getFinancialMonthStart(date: Date, financialDayStart: number): Date {
  const start = new Date(date);
  if (start.getDate() >= financialDayStart) {
    start.setDate(financialDayStart);
  } else {
    start.setDate(financialDayStart);
    start.setMonth(start.getMonth() - 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getFinancialMonthEnd(date: Date, financialDayStart: number): Date {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = new Date(start);
  // Add one month to get the start of next financial month
  end.setMonth(end.getMonth() + 1);
  // Set to the day before next financial month starts (handles year rollover automatically)
  end.setDate(financialDayStart - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getFinancialMonthBoundaries(date: Date = new Date(), financialDayStart: number = 1): {
  from: number;
  to: number;
  fromDate: Date;
  toDate: Date;
} {
  const fromDate = getFinancialMonthStart(date, financialDayStart);
  const toDate = getFinancialMonthEnd(date, financialDayStart);

  return {
    from: Math.floor(fromDate.getTime() / 1000),
    to: Math.floor(toDate.getTime() / 1000),
    fromDate,
    toDate,
  };
}

/**
 * Check if two dates are in the same financial month
 */
export function isSameFinancialMonth(date1: Date, date2: Date, financialDayStart: number): boolean {
  const start1 = getFinancialMonthStart(date1, financialDayStart);
  const start2 = getFinancialMonthStart(date2, financialDayStart);
  return start1.getTime() === start2.getTime();
}

export function groupTransactionsByDay(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();

  transactions.forEach((tx) => {
    const date = new Date(tx.time * 1000);
    const key = date.toISOString().split("T")[0];

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(tx);
  });

  return grouped;
}

export function formatAmount(amount: number): string {
  return (Math.abs(amount) / 100).toFixed(2);
}

// Check if transaction is ATM cash withdrawal
export function isCashWithdrawal(transaction: Transaction): boolean {
  const description = transaction.description.toLowerCase();
  return (
    description.includes("банкомат") ||
    description.includes("atm") ||
    description.includes("cash") ||
    description.includes("готівка")
  );
}

export function isInternalTransfer(transaction: Transaction, allTransactions?: Transaction[], includedTransactionIds?: string[]): boolean {
  // If this transaction is manually included, it's NOT an internal transfer for budget purposes
  if (includedTransactionIds?.includes(transaction.id)) {
    return false;
  }

  const description = transaction.description.toLowerCase();

  // Heuristic based on common Monobank descriptions for internal transfers between OWN accounts
  // Note: "переказ на картку" is NOT filtered - it could be a transfer to another person
  const hasInternalKeywords =
    description.includes("з білої картки") ||
    description.includes("на білу картку") ||
    description.includes("власні кошти") ||
    description.includes("між картками") ||
    description.includes("f2f");

  if (hasInternalKeywords) return true;

  // Filter out ONLY savings-related operations (накопичення, депозити, оренда банки)
  // NOT charity donations or transfers to other people
  const isSavingsOperation =
    description.includes("накопичення") ||
    description.includes("депозит") ||
    description.includes("відкриття депозиту") ||
    description.includes("поповнення депозиту") ||
    description.includes("часткове зняття банки") ||
    description.includes("зняття банки") ||
    description.includes("«оренда»") ||
    description.includes("поповнення «оренда»");

  if (isSavingsOperation) return true;

  // ATM withdrawals are not expenses - they're just cash conversion
  if (isCashWithdrawal(transaction)) return true;

  // Exact amount match logic: if we find another transaction with the exact opposite amount
  // on the same day, it's very likely an internal transfer.
  if (allTransactions) {
    const txDate = new Date(transaction.time * 1000).toDateString();
    const oppositeAmount = -transaction.amount;

    const hasMatch = allTransactions.some(other =>
      other.id !== transaction.id &&
      other.amount === oppositeAmount &&
      new Date(other.time * 1000).toDateString() === txDate
    );

    if (hasMatch) return true;
  }

  return false;
}

/**
 * Check if a transaction would be auto-excluded (internal transfer, ATM withdrawal)
 * This is used to determine if a transaction can be manually included
 */
export function isAutoExcluded(transaction: Transaction, allTransactions?: Transaction[]): boolean {
  if (transaction.amount >= 0) return false;

  const description = transaction.description.toLowerCase();

  // Check internal transfer keywords
  const hasInternalKeywords =
    description.includes("з білої картки") ||
    description.includes("на білу картку") ||
    description.includes("власні кошти") ||
    description.includes("між картками") ||
    description.includes("f2f");

  if (hasInternalKeywords) return true;

  // Check savings operations
  const isSavingsOperation =
    description.includes("накопичення") ||
    description.includes("депозит") ||
    description.includes("відкриття депозиту") ||
    description.includes("поповнення депозиту") ||
    description.includes("часткове зняття банки") ||
    description.includes("зняття банки") ||
    description.includes("«оренда»") ||
    description.includes("поповнення «оренда»");

  if (isSavingsOperation) return true;

  // ATM withdrawals
  if (isCashWithdrawal(transaction)) return true;

  // Exact amount match logic
  if (allTransactions) {
    const txDate = new Date(transaction.time * 1000).toDateString();
    const oppositeAmount = -transaction.amount;

    const hasMatch = allTransactions.some(other =>
      other.id !== transaction.id &&
      other.amount === oppositeAmount &&
      new Date(other.time * 1000).toDateString() === txDate
    );

    if (hasMatch) return true;
  }

  return false;
}

export function isExpense(transaction: Transaction, allTransactions?: Transaction[], includedTransactionIds?: string[]): boolean {
  if (transaction.amount >= 0) return false;
  if (isInternalTransfer(transaction, allTransactions, includedTransactionIds)) return false;
  return true;
}

export function isIncome(transaction: Transaction, allTransactions?: Transaction[], includedTransactionIds?: string[]): boolean {
  if (transaction.amount <= 0) return false;
  if (isInternalTransfer(transaction, allTransactions, includedTransactionIds)) return false;
  return true;
}
