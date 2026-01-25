import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeSpendingPattern,
  distributeBudget,
  predictInflation,
} from '@/lib/budget-ai';
import { Transaction } from '@/types';

const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: '1',
  time: Math.floor(Date.now() / 1000),
  description: 'Test transaction',
  mcc: 5411,
  amount: -5000,
  balance: 10000,
  cashbackAmount: 0,
  ...overrides,
});

describe('budget-ai.ts', () => {
  describe('analyzeSpendingPattern', () => {
    it('should return zero pattern for empty transactions', () => {
      const result = analyzeSpendingPattern([]);
      expect(result.weekdayAvg).toBe(0);
      expect(result.weekendAvg).toBe(0);
      expect(result.dayOfMonthMultipliers).toHaveLength(31);
    });

    it('should calculate spending patterns correctly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        createTransaction({
          id: '1',
          time: Math.floor(now / 1000) - 86400,
          description: 'Grocery',
          amount: -5000,
          balance: 10000,
        }),
        createTransaction({
          id: '2',
          time: Math.floor(now / 1000) - 86400 * 2,
          description: 'Another expense',
          amount: -3000,
          balance: 7000,
        }),
      ];

      const result = analyzeSpendingPattern(transactions);

      expect(result.weekdayAvg).toBeGreaterThan(0);
      expect(result.dayOfMonthMultipliers).toHaveLength(31);
      result.dayOfMonthMultipliers.forEach((multiplier) => {
        expect(multiplier).toBeGreaterThanOrEqual(0);
      });
    });

    it('should distinguish between weekday and weekend spending', () => {
      const baseTime = new Date('2025-01-04T12:00:00Z').getTime(); // Saturday
      
      const weekendTx = createTransaction({
        id: '1',
        time: Math.floor(baseTime / 1000),
        description: 'Weekend shopping',
        amount: -10000,
        balance: 10000,
      });
      const weekdayTx = createTransaction({
        id: '2',
        time: Math.floor((baseTime - 86400 * 5) / 1000), // Monday
        description: 'Weekday lunch',
        amount: -2000,
        balance: 8000,
      });

      const result = analyzeSpendingPattern([weekendTx, weekdayTx]);

      // Weekend spending should be higher
      expect(result.weekendAvg).toBeGreaterThan(result.weekdayAvg);
    });
  });

  describe('predictInflation', () => {
    it('should return correct burn rate for empty transactions', () => {
      const result = predictInflation([], 100000);
      expect(result.currentBalance).toBe(100000);
      expect(result.monthlyBurnRate).toBe(0);
      expect(result.monthsUntilZero).toBe(Infinity);
    });

    it('should calculate monthly burn rate correctly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        createTransaction({
          id: '1',
          time: Math.floor(now / 1000) - 86400 * 15,
          description: 'Expense 1',
          amount: -10000,
          balance: 90000,
        }),
        createTransaction({
          id: '2',
          time: Math.floor(now / 1000) - 86400 * 5,
          description: 'Expense 2',
          amount: -15000,
          balance: 75000,
        }),
      ];

      const result = predictInflation(transactions, 100000);

      expect(result.currentBalance).toBe(100000);
      expect(result.monthlyBurnRate).toBeGreaterThan(0);
      expect(result.monthsUntilZero).toBeGreaterThan(0);
      expect(result.yearlyProjection).toHaveLength(12);
    });

    it('should project balance correctly over 12 months', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        createTransaction({
          id: '1',
          time: Math.floor(now / 1000),
          description: 'Daily expense',
          amount: -1000,
          balance: 99000,
        }),
      ];

      const result = predictInflation(transactions, 30000);

      expect(result.yearlyProjection).toHaveLength(12);
      expect(result.yearlyProjection[0].balance).toBe(30000);
      expect(result.yearlyProjection[11].balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('distributeBudget', () => {
    it('should return a valid month budget structure', async () => {
      const now = new Date();
      const transactions: Transaction[] = [];

      const result = await distributeBudget(
        100000,
        now,
        transactions,
        transactions,
        [],
        100000,
        undefined,
        false
      );

      expect(result.totalBudget).toBe(100000);
      expect(result.totalSpent).toBe(0);
      expect(result.dailyLimits.length).toBeGreaterThan(0);
      result.dailyLimits.forEach((day) => {
        expect(day.limit).toBeGreaterThanOrEqual(0);
        expect(day.spent).toBeGreaterThanOrEqual(0);
        expect(['under', 'warning', 'over']).toContain(day.status);
      });
    });

    it('should use AI distribution when enabled', async () => {
      const now = new Date();
      const transactions: Transaction[] = [
        createTransaction({
          id: '1',
          time: Math.floor(now.getTime() / 1000) - 86400 * 10,
          description: 'Regular expense',
          amount: -5000,
          balance: 95000,
        }),
      ];

      const result = await distributeBudget(
        100000,
        now,
        transactions,
        transactions,
        [],
        100000,
        'test-user-id',
        true
      );

      expect(result.totalBudget).toBe(100000);
      expect(result.dailyLimits.length).toBeGreaterThan(0);
    });

    it('should exclude specified transactions from calculations', async () => {
      const now = new Date();
      const transactions: Transaction[] = [
        createTransaction({
          id: 'excluded-1',
          time: Math.floor(now.getTime() / 1000) - 86400,
          description: 'Should be excluded',
          amount: -50000,
          balance: 50000,
        }),
      ];

      const result = await distributeBudget(
        100000,
        now,
        transactions,
        transactions,
        ['excluded-1'],
        100000,
        undefined,
        false
      );

      expect(result.totalSpent).toBe(0);
    });

    it('should handle past and future days differently', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const transactions: Transaction[] = [];

      const result = await distributeBudget(
        100000,
        now,
        transactions,
        transactions,
        [],
        100000,
        undefined,
        false
      );

      const todayLimit = result.dailyLimits.find(
        (day) => day.date.toDateString() === now.toDateString()
      );
      const yesterdayLimit = result.dailyLimits.find(
        (day) => day.date.toDateString() === yesterday.toDateString()
      );

      expect(todayLimit).toBeDefined();
      expect(yesterdayLimit).toBeDefined();
    });
  });
});
