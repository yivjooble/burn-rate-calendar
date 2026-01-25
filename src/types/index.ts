export interface Transaction {
  id: string;
  time: number;
  description: string;
  mcc: number;
  amount: number;
  balance: number;
  cashbackAmount: number;
  comment?: string;
  currencyCode?: number;
}

export const CURRENCY_SYMBOLS: Record<number, string> = {
  980: "₴",
  840: "$",
  978: "€",
  826: "£",
  985: "zł",
};

export function getCurrencySymbol(currencyCode?: number): string {
  if (!currencyCode) return "₴";
  return CURRENCY_SYMBOLS[currencyCode] || "₴";
}

export interface CurrencyRate {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateBuy?: number;
  rateSell?: number;
  rateCross?: number;
}

// Convert amount from foreign currency to UAH
export function convertToUAH(
  amount: number,
  currencyCode: number | undefined,
  rates: CurrencyRate[]
): number {
  if (!currencyCode || currencyCode === 980) return amount; // Already UAH
  
  // Find rate for this currency to UAH (980)
  const rate = rates.find(
    r => r.currencyCodeA === currencyCode && r.currencyCodeB === 980
  );
  
  if (!rate) return amount; // No rate found, return as-is
  
  // Use rateSell for converting foreign to UAH (bank sells UAH)
  const exchangeRate = rate.rateCross || rate.rateSell || rate.rateBuy || 1;
  return amount * exchangeRate;
}

export interface DayBudget {
  date: Date;
  limit: number;
  spent: number;
  remaining: number;
  transactions: Transaction[];
  status: "under" | "warning" | "over";
  confidence?: number; // AI confidence level (0-1)
  reasoning?: string; // AI explanation for the limit
}

export interface MonthBudget {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  daysRemaining: number;
  dailyLimits: DayBudget[];
  aiRecommendation?: string;
  currentBalance?: number; // Current card balance for daily limit calculation
  dailyAverage?: number; // Average spent per day
  isHistorical?: boolean; // Whether this is a historical month view
}

export interface StoredDailyBudget {
  date: string;
  limit: number;
  spent: number;
  balance: number;
}

export interface UserSettings {
  monoToken?: string;
  monthlyBudget?: number; // Deprecated - now uses card balance
  accountId: string; // Selected card ID
  accountBalance?: number; // Current balance of selected card (in kopecks)
  accountCurrency?: number; // Currency code of selected card
  selectedAccountIds?: string[]; // Deprecated - now single account
  selectedAccountCurrencies?: number[]; // Deprecated
  financialMonthStart?: number; // Day of month when financial month starts (1-31)
  useAIBudget?: boolean; // Enable AI-powered budget distribution
}

export interface MonoClientInfo {
  clientId: string;
  name: string;
  accounts: MonoAccount[];
}

export interface MonoAccount {
  id: string;
  sendId: string;
  currencyCode: number;
  cashbackType: string;
  balance: number;
  creditLimit: number;
  maskedPan: string[];
  type: string;
  iban: string;
}

export interface InflationPrediction {
  currentBalance: number;
  predictedBalance: number;
  monthlyBurnRate: number;
  monthsUntilZero: number;
  yearlyProjection: {
    month: string;
    balance: number;
  }[];
  confidence: number;
}
