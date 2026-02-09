export const FEATURES = {
  USE_SWR_BUDGET: process.env.NEXT_PUBLIC_FEATURE_SWR_BUDGET !== "false",
  USE_SWR_SETTINGS: process.env.NEXT_PUBLIC_FEATURE_SWR_SETTINGS !== "false",
  USE_SWR_CATEGORIES: process.env.NEXT_PUBLIC_FEATURE_SWR_CATEGORIES !== "false",
  OPTIMISTIC_UPDATES: process.env.NEXT_PUBLIC_FEATURE_OPTIMISTIC !== "false",
  REAL_TIME_SYNC: process.env.NEXT_PUBLIC_FEATURE_REALTIME !== "false",
} as const;

export function useFeatureFlag(flag: keyof typeof FEATURES): boolean {
  return FEATURES[flag];
}
