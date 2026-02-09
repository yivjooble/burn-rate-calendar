import useSWR, { mutate } from "swr";
import { UserSettings, MonthBudget, CustomCategory } from "@/types";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
};

// =============================================================================
// SWR Hooks for BRC Real-time Updates
// =============================================================================

/**
 * Hook for fetching and managing user settings with real-time updates
 * Refreshes every 30 seconds
 */
export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<UserSettings>(
    "/api/db/user-settings",
    fetcher,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    settings: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Hook for fetching and managing budget with real-time updates
 * Refreshes every 10 seconds for live updates
 */
export function useBudget(options?: { accountId?: string; month?: string }) {
  const queryParams = new URLSearchParams();
  if (options?.accountId) queryParams.set("accountId", options.accountId);
  if (options?.month) queryParams.set("month", options.month);
  
  const url = `/api/db/budget${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<MonthBudget>(
    url,
    fetcher,
    {
      refreshInterval: 10000, // 10 seconds for live updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }
  );

  return {
    budget: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Hook for fetching user categories
 */
export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<CustomCategory[]>(
    "/api/db/categories",
    fetcher,
    {
      refreshInterval: 60000, // 1 minute - categories don't change often
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  return {
    categories: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// =============================================================================
// Optimistic Update Functions - REMOVED
// =============================================================================
// The old updateSettingsOptimistic function used useSettings() inside an async function,
// which is a React hooks violation. Use the hook-based approach in useOptimisticUpdates.ts instead.

/**
 * Trigger budget recalculation
 */
export async function recalculateBudget() {
  await mutate("/api/db/budget");
}

/**
 * Trigger full data refresh after sync
 */
export async function refreshAllData() {
  await Promise.all([
    mutate("/api/db/user-settings"),
    mutate("/api/db/budget"),
    mutate("/api/db/categories"),
  ]);
}
