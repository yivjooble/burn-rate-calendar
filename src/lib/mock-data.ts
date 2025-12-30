import { Transaction } from "@/types";
import { subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

const descriptions = [
  "АТБ-Маркет",
  "Сільпо",
  "Rozetka",
  "Bolt",
  "Glovo",
  "McDonald's",
  "Starbucks",
  "Netflix",
  "Spotify",
  "Apple",
  "Amazon",
  "Аптека",
  "АЗС ОККО",
  "Нова Пошта",
  "Київстар",
  "Комунальні послуги",
  "Ресторан",
  "Кав'ярня",
  "Спортзал",
  "Книгарня",
];

const mccCodes = [5411, 5812, 5814, 4121, 5999, 5912, 5541, 4814, 7832, 7941];

function randomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 100;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMockTransactions(days: number = 60): Transaction[] {
  const transactions: Transaction[] = [];
  const now = new Date();
  let balance = 5000000;
  const rand = seededRandom(42);

  for (let i = days; i >= 0; i--) {
    const date = subDays(now, i);
    const dayOfMonth = date.getDate();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    // Vary spending patterns: some days low, some medium, some high
    let spendingMultiplier = 1;
    if (dayOfMonth % 7 === 0) spendingMultiplier = 0.2; // Very low spending
    else if (dayOfMonth % 5 === 0) spendingMultiplier = 0.4; // Low spending
    else if (dayOfMonth % 3 === 0) spendingMultiplier = 0.7; // Medium spending
    else if (isWeekend) spendingMultiplier = 1.2; // Higher on weekends
    
    const txCount = Math.max(1, Math.floor((rand() * 3 + 1) * spendingMultiplier));

    for (let j = 0; j < txCount; j++) {
      const baseAmount = isWeekend ? 200 : 150;
      const amount = -Math.floor(rand() * baseAmount * spendingMultiplier + 20) * 100;
      balance += amount;

      transactions.push({
        id: `tx-${i}-${j}-${Math.floor(rand() * 1000000)}`,
        time: Math.floor(date.getTime() / 1000) + j * 3600,
        description: descriptions[Math.floor(rand() * descriptions.length)],
        mcc: mccCodes[Math.floor(rand() * mccCodes.length)],
        amount,
        balance,
        cashbackAmount: Math.abs(amount) > 10000 ? Math.floor(Math.abs(amount) * 0.02) : 0,
      });
    }

    if (i % 30 === 0 || i === days) {
      const income = Math.floor(rand() * 10000 + 20000) * 100;
      balance += income;
      transactions.push({
        id: `income-${i}-${Math.floor(rand() * 1000000)}`,
        time: Math.floor(date.getTime() / 1000) + 43200,
        description: "Зарплата",
        mcc: 0,
        amount: income,
        balance,
        cashbackAmount: 0,
      });
    }
  }

  return transactions.sort((a, b) => b.time - a.time);
}

export function getCurrentMonthTransactions(
  allTransactions: Transaction[]
): Transaction[] {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return allTransactions.filter((tx) => {
    const txDate = new Date(tx.time * 1000);
    return txDate >= monthStart && txDate <= monthEnd;
  });
}

export function getPreviousMonthTransactions(
  allTransactions: Transaction[]
): Transaction[] {
  const now = new Date();
  const prevMonthStart = startOfMonth(subDays(startOfMonth(now), 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);

  return allTransactions.filter((tx) => {
    const txDate = new Date(tx.time * 1000);
    return txDate >= prevMonthStart && txDate <= prevMonthEnd;
  });
}
