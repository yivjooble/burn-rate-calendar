import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateHistoricalMonthSummary,
  isCurrentFinancialMonth,
} from "./historical-budget";
import { Transaction, StoredDailyBudget } from "@/types";

// Mock monobank functions
vi.mock("./monobank", () => ({
  isExpense: (tx: Transaction) => tx.amount < 0,
  getFinancialMonthStart: (date: Date, dayStart: number) => {
    const start = new Date(date);
    if (start.getDate() >= dayStart) {
      start.setDate(dayStart);
    } else {
      start.setDate(dayStart);
      start.setMonth(start.getMonth() - 1);
    }
    start.setHours(0, 0, 0, 0);
    return start;
  },
  getFinancialMonthEnd: (date: Date, dayStart: number) => {
    const start = new Date(date);
    if (start.getDate() >= dayStart) {
      start.setDate(dayStart);
    } else {
      start.setDate(dayStart);
      start.setMonth(start.getMonth() - 1);
    }
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(dayStart - 1);
    end.setHours(23, 59, 59, 999);
    return end;
  },
}));

describe("calculateHistoricalMonthSummary", () => {
  const createTransaction = (
    id: string,
    amount: number,
    time: number
  ): Transaction => ({
    id,
    amount,
    time,
    description: "Test transaction",
    mcc: 5411,
    balance: 100000,
    cashbackAmount: 0,
  });

  const monthStart = new Date("2024-01-05");
  const monthEnd = new Date("2024-02-04");

  describe("basic calculations", () => {
    it("should calculate total spent correctly", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -10000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
        createTransaction("2", -5000, Math.floor(new Date("2024-01-15").getTime() / 1000)),
        createTransaction("3", -3000, Math.floor(new Date("2024-01-20").getTime() / 1000)),
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(18000);
      expect(result.isHistorical).toBe(true);
    });

    it("should exclude transactions in excludedTransactionIds", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -10000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
        createTransaction("2", -5000, Math.floor(new Date("2024-01-15").getTime() / 1000)),
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: ["1"],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(5000);
    });

    it("should filter out income transactions (positive amounts)", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -10000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
        createTransaction("2", 50000, Math.floor(new Date("2024-01-15").getTime() / 1000)), // Income
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(10000);
    });

    it("should filter transactions outside date range", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -10000, Math.floor(new Date("2024-01-10").getTime() / 1000)), // In range
        createTransaction("2", -5000, Math.floor(new Date("2023-12-15").getTime() / 1000)), // Before range
        createTransaction("3", -3000, Math.floor(new Date("2024-03-01").getTime() / 1000)), // After range
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(10000);
    });
  });

  describe("daily limits", () => {
    it("should create daily limits for all days in month", () => {
      const result = calculateHistoricalMonthSummary({
        transactions: [],
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      // Financial month from Jan 5 to Feb 4 = 31 days
      expect(result.dailyLimits.length).toBe(31);
    });

    it("should use stored daily budgets when available", () => {
      const storedBudgets: StoredDailyBudget[] = [
        { date: "2024-01-10", limit: 5000, spent: 3000, balance: 2000 },
      ];

      const result = calculateHistoricalMonthSummary({
        transactions: [],
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
        storedBudgets,
      });

      const jan10 = result.dailyLimits.find(
        (d) => d.date.getDate() === 10 && d.date.getMonth() === 0
      );
      expect(jan10?.limit).toBe(5000);
    });

    it("should calculate correct status based on percentage", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -12000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
      ];

      const storedBudgets: StoredDailyBudget[] = [
        { date: "2024-01-10", limit: 10000, spent: 0, balance: 10000 },
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
        storedBudgets,
      });

      const jan10 = result.dailyLimits.find(
        (d) => d.date.getDate() === 10 && d.date.getMonth() === 0
      );
      expect(jan10?.status).toBe("over"); // 120% spent
    });

    it("should set warning status between 80-100%", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -9000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
      ];

      const storedBudgets: StoredDailyBudget[] = [
        { date: "2024-01-10", limit: 10000, spent: 0, balance: 10000 },
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
        storedBudgets,
      });

      const jan10 = result.dailyLimits.find(
        (d) => d.date.getDate() === 10 && d.date.getMonth() === 0
      );
      expect(jan10?.status).toBe("warning"); // 90% spent
    });
  });

  describe("edge cases", () => {
    it("should handle empty transactions", () => {
      const result = calculateHistoricalMonthSummary({
        transactions: [],
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(0);
      expect(result.totalBudget).toBe(0);
      expect(result.dailyAverage).toBe(0);
    });

    it("should handle all transactions excluded", () => {
      const transactions: Transaction[] = [
        createTransaction("1", -10000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: ["1"],
        monthStart,
        monthEnd,
      });

      expect(result.totalSpent).toBe(0);
    });

    it("should set daysRemaining to 0 for historical months", () => {
      const result = calculateHistoricalMonthSummary({
        transactions: [],
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
      });

      expect(result.daysRemaining).toBe(0);
    });

    it("should calculate totalRemaining correctly", () => {
      const storedBudgets: StoredDailyBudget[] = [
        { date: "2024-01-10", limit: 10000, spent: 0, balance: 10000 },
        { date: "2024-01-11", limit: 10000, spent: 0, balance: 10000 },
      ];

      const transactions: Transaction[] = [
        createTransaction("1", -5000, Math.floor(new Date("2024-01-10").getTime() / 1000)),
      ];

      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: [],
        monthStart,
        monthEnd,
        storedBudgets,
      });

      expect(result.totalBudget).toBe(20000);
      expect(result.totalSpent).toBe(5000);
      expect(result.totalRemaining).toBe(15000);
    });
  });

  describe("performance (Set vs Array)", () => {
    it("should handle large excludedTransactionIds efficiently", () => {
      // Create 1000 transactions
      const transactions: Transaction[] = Array.from({ length: 1000 }, (_, i) =>
        createTransaction(`tx-${i}`, -100, Math.floor(new Date("2024-01-10").getTime() / 1000))
      );

      // Exclude 500 of them
      const excludedIds = Array.from({ length: 500 }, (_, i) => `tx-${i}`);

      const start = performance.now();
      const result = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds: excludedIds,
        monthStart,
        monthEnd,
      });
      const duration = performance.now() - start;

      expect(result.totalSpent).toBe(50000); // 500 transactions * 100
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});

describe("isCurrentFinancialMonth", () => {
  it("should return true for current financial month", () => {
    const today = new Date();
    const result = isCurrentFinancialMonth(today, 1);
    expect(result).toBe(true);
  });

  it("should return false for past financial month", () => {
    const pastMonth = new Date();
    pastMonth.setMonth(pastMonth.getMonth() - 2);
    const result = isCurrentFinancialMonth(pastMonth, 1);
    expect(result).toBe(false);
  });

  it("should handle custom financial month start day", () => {
    // If today is Jan 10 with financialDayStart=5, current month is Jan 5 - Feb 4
    // A date of Jan 3 should be in the previous financial month (Dec 5 - Jan 4)
    const today = new Date("2024-01-10");
    vi.useFakeTimers();
    vi.setSystemTime(today);

    const jan3 = new Date("2024-01-03");
    const result = isCurrentFinancialMonth(jan3, 5);
    expect(result).toBe(false);

    vi.useRealTimers();
  });
});
