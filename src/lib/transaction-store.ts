import { Transaction } from "@/types";

const API_BASE = "/api/db/historical";

interface MetaData {
  lastSyncTime: number | null;
  historicalDataLoaded: boolean;
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const response = await fetch(`${API_BASE}?type=append`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactions),
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Failed to save transactions:", response.status, errorData);
    throw new Error(errorData.details || errorData.error || "Failed to save transactions");
  }
}

export async function getTransactions(
  fromTimestamp?: number,
  toTimestamp?: number
): Promise<Transaction[]> {
  const allTransactions = await getAllTransactions();
  
  return allTransactions.filter((tx) => {
    if (fromTimestamp && tx.time < fromTimestamp) return false;
    if (toTimestamp && tx.time > toTimestamp) return false;
    return true;
  });
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const response = await fetch(API_BASE, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to get transactions");
  }
  return response.json();
}

export async function deleteTransactionsAfter(timestamp: number): Promise<void> {
  const response = await fetch(`${API_BASE}?after=${timestamp}`, {
    method: "DELETE",
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete transactions");
  }
}

async function getMeta(): Promise<MetaData> {
  const response = await fetch(`${API_BASE}?type=meta`, { credentials: "include" });
  if (!response.ok) {
    return { lastSyncTime: null, historicalDataLoaded: false };
  }
  return response.json();
}

async function setMeta(data: Partial<MetaData>): Promise<void> {
  const response = await fetch(`${API_BASE}?type=meta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to save meta");
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  const meta = await getMeta();
  return meta.lastSyncTime;
}

export async function setLastSyncTime(timestamp: number): Promise<void> {
  await setMeta({ lastSyncTime: timestamp });
}

export async function getHistoricalDataLoaded(): Promise<boolean> {
  const meta = await getMeta();
  return meta.historicalDataLoaded === true;
}

export async function setHistoricalDataLoaded(loaded: boolean): Promise<void> {
  await setMeta({ historicalDataLoaded: loaded });
}

export async function clearAllData(): Promise<void> {
  const response = await fetch(API_BASE, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to clear data");
  }
}
