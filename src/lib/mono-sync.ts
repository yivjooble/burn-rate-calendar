import { Transaction, CurrencyRate } from "@/types";
import {
  saveTransactions,
  getTransactions,
  getAllTransactions,
  deleteTransactionsAfter,
  getLastSyncTime,
  setLastSyncTime,
  getHistoricalDataLoaded,
  setHistoricalDataLoaded,
  getHistoricalPeriod,
  setHistoricalPeriod,
} from "./transaction-store";
import { subMonths, startOfMonth, endOfMonth, startOfDay } from "date-fns";

interface SyncProgress {
  current: number;
  total: number;
  message: string;
}

interface SyncResult {
  transactions: Transaction[];
  isInitialLoad: boolean;
  error?: string;
}

export async function fetchCurrencyRates(): Promise<CurrencyRate[]> {
  try {
    const response = await fetch("/api/mono/currency");
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Ignore errors
  }
  return [];
}

async function fetchAccountCurrencies(): Promise<Record<string, number>> {
  const currencies: Record<string, number> = {};
  try {
    // Use proxy API - token is retrieved from DB server-side
    const response = await fetch("/api/mono/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "/personal/client-info" }),
    });
    if (response.ok) {
      const clientInfo = await response.json();
      clientInfo.accounts?.forEach((acc: { id: string; currencyCode: number }) => {
        currencies[acc.id] = acc.currencyCode;
      });
    }
  } catch {
    // Ignore errors
  }
  return currencies;
}

async function fetchMonthTransactions(
  accountId: string,
  currencyCode: number,
  from: number,
  to: number
): Promise<Transaction[]> {
  // Use proxy API - token is retrieved from DB server-side
  const response = await fetch("/api/mono/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: `/personal/statement/${accountId}/${from}/${to}`,
    }),
  });

  if (response.status === 429) {
    throw new Error("RATE_LIMIT");
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Error: ${response.status}`);
  }

  const data = await response.json();
  // Add currencyCode to each transaction
  return data.map((tx: Transaction) => ({ ...tx, currencyCode }));
}

export async function loadHistoricalData(
  accountIds: string[],
  onProgress?: (progress: SyncProgress) => void,
  dateRange?: { from: Date; to: Date }
): Promise<Transaction[]> {
  // Token is now retrieved from DB server-side via proxy
  const accountCurrencies = await fetchAccountCurrencies();
  const now = new Date();
  
  // Calculate months to fetch based on date range or default to 12 months
  const startDate = dateRange?.from || subMonths(now, 12);
  const endDate = dateRange?.to || now;
  
  // Calculate number of months between dates
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth()) + 1;
  const monthsToFetch = Math.max(1, monthsDiff);
  
  const allTransactions: Transaction[] = [];

  const totalRequests = monthsToFetch * accountIds.length;
  let completedRequests = 0;

  for (let i = 0; i < monthsToFetch; i++) {
    const monthDate = subMonths(endDate, i);
    // Skip months that are before startDate
    if (monthDate < startOfMonth(startDate) && i > 0) continue;
    
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const from = Math.floor(monthStart.getTime() / 1000);
    const to = Math.floor(monthEnd.getTime() / 1000);

    for (const accountId of accountIds) {
      const currencyCode = accountCurrencies[accountId] || 980;

      onProgress?.({
        current: completedRequests,
        total: totalRequests,
        message: `Завантаження ${i + 1}/${monthsToFetch} місяців...`,
      });

      // Wait for rate limit between requests (except first)
      if (completedRequests > 0) {
        onProgress?.({
          current: completedRequests,
          total: totalRequests,
          message: `Очікування rate limit... (${completedRequests}/${totalRequests})`,
        });
        await new Promise((resolve) => setTimeout(resolve, 61000));
      }

      try {
        const transactions = await fetchMonthTransactions(
          accountId,
          currencyCode,
          from,
          to
        );
        allTransactions.push(...transactions);
        completedRequests++;
      } catch (err) {
        if (err instanceof Error && err.message === "RATE_LIMIT") {
          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, 61000));
          try {
            const transactions = await fetchMonthTransactions(
              accountId,
              currencyCode,
              from,
              to
            );
            allTransactions.push(...transactions);
          } catch {
            // Skip this month/account
          }
        }
        completedRequests++;
      }
    }
  }

  // Save to DB
  await saveTransactions(allTransactions);
  await setHistoricalDataLoaded(true);
  await setLastSyncTime(Date.now());
  // Save the period that was loaded
  await setHistoricalPeriod(
    Math.floor(startDate.getTime() / 1000),
    Math.floor(endDate.getTime() / 1000)
  );

  return allTransactions;
}

export async function refreshTodayTransactions(
  accountIds: string[]
): Promise<Transaction[]> {
  // Token is now retrieved from DB server-side via proxy
  const accountCurrencies = await fetchAccountCurrencies();
  const now = new Date();
  const todayStart = startOfDay(now);
  const from = Math.floor(todayStart.getTime() / 1000);
  const to = Math.floor(now.getTime() / 1000);

  // Delete today's transactions first (they might have changed)
  await deleteTransactionsAfter(from);

  const todayTransactions: Transaction[] = [];

  for (let i = 0; i < accountIds.length; i++) {
    const accountId = accountIds[i];
    const currencyCode = accountCurrencies[accountId] || 980;

    // Small delay between accounts to avoid rate limit
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      const transactions = await fetchMonthTransactions(
        accountId,
        currencyCode,
        from,
        to
      );
      todayTransactions.push(...transactions);
    } catch {
      // Ignore errors for individual accounts
    }
  }

  // Save today's transactions
  if (todayTransactions.length > 0) {
    await saveTransactions(todayTransactions);
  }
  await setLastSyncTime(Date.now());

  return todayTransactions;
}

export async function syncTransactions(
  accountIds: string[],
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const isHistoricalLoaded = await getHistoricalDataLoaded();

  if (!isHistoricalLoaded) {
    // First time - load all historical data (token retrieved from DB via proxy)
    const transactions = await loadHistoricalData(accountIds, onProgress);
    return { transactions, isInitialLoad: true };
  }

  // Just refresh today's transactions
  await refreshTodayTransactions(accountIds);
  const allTransactions = await getAllTransactions();
  return { transactions: allTransactions, isInitialLoad: false };
}

export async function getStoredTransactions(
  fromTimestamp?: number,
  toTimestamp?: number
): Promise<Transaction[]> {
  return getTransactions(fromTimestamp, toTimestamp);
}

export async function getAllStoredTransactions(): Promise<Transaction[]> {
  return getAllTransactions();
}

export async function isHistoricalDataAvailable(): Promise<boolean> {
  return getHistoricalDataLoaded();
}

export async function getLastSync(): Promise<number | null> {
  return getLastSyncTime();
}

export async function getLoadedPeriod(): Promise<{ from: number | null; to: number | null }> {
  return getHistoricalPeriod();
}
