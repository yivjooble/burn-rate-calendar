# Project Quick Reference for AI

## 🚀 Quick Start Guide

This document provides essential context for AI assistants working on the Burn Rate Calendar project.

## 📁 Project Structure

```
burn-rate-calendar/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/              # API routes
│   │   │   ├── ai/           # AI budget distribution
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── db/            # Database CRUD operations
│   │   │   └── mono/          # Monobank integration
│   │   └── page.tsx          # Main application page
│   ├── components/              # React components
│   │   ├── ui/               # Reusable UI components
│   │   ├── budget-calendar.tsx # Calendar with financial months
│   │   ├── settings-panel.tsx # User settings
│   │   └── day-detail-modal.tsx # Transaction details
│   ├── lib/                    # Utility libraries
│   │   ├── budget-ai.ts      # AI budget distribution
│   │   ├── mono-sync.ts       # Monobank sync logic
│   │   └── db.ts             # Database operations
│   ├── store/                  # State management
│   │   └── budget-store.ts    # Zustand global state
│   └── types/                  # TypeScript definitions
│       └── index.ts           # All type definitions
├── claudedocs/               # AI documentation (this folder)
└── prisma/                   # Database schema
    └── schema.prisma
```

## 🔧 Key Technologies

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Zustand (global state) + IndexedDB (offline)
- **Language**: TypeScript with strict mode
- **Date Handling**: date-fns with Ukrainian locale

### Backend Stack
- **API**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 with credentials provider
- **Deployment**: Railway (PostgreSQL + Node.js)

### External Services
- **Banking**: Monobank API (Ukrainian bank)
- **Currency**: Exchange rate API for multi-currency support

## 🎯 Core Features

### 1. Budget Management
```typescript
// Main budget calculation function
distributeBudget(
  totalBudget: number,
  currentDate: Date,
  pastTransactions: Transaction[],
  currentMonthTransactions: Transaction[],
  excludedTransactionIds: string[],
  currentBalance?: number,
  userId?: string,
  useAI: boolean = true
): Promise<MonthBudget>
```

### 2. Financial Months
```typescript
// Custom financial month start (1-31 day of month)
interface UserSettings {
  financialMonthStart?: number; // Default: 1 (1st of month)
}

// Example: financialMonthStart = 5
// Result: Budget period from 5th to 4th of next month
```

### 3. AI Budget Distribution
```typescript
// AI endpoint for intelligent budget allocation
POST /api/ai/budget-distribution
{
  totalBudget: number,
  currentBalance: number,
  transactions: TransactionData[],
  startDate: string, // ISO date
  endDate: string   // ISO date
}

// Response with AI-generated daily limits
{
  dailyBudgets: [{
    date: string,
    limit: number,
    confidence: number,    // 0-1 AI confidence
    reasoning?: string    // AI explanation
  }]
}
```

## 🗄️ Database Schema

### Core Tables
```sql
-- Users and authentication
User {
  id: String (primary key)
  email: String (unique)
  passwordHash: String
  createdAt: DateTime
}

-- User settings (encrypted)
UserSettings {
  userId: String (foreign key)
  monoToken: String (encrypted)
  accountId: String
  financialMonthStart: Int
  useAIBudget: Boolean
}

-- Transactions (per user)
UserTransaction {
  id: String (primary key)
  userId: String (foreign key)
  amount: Int (in kopecks)
  description: String
  mcc: Int (category code)
  time: Int (Unix timestamp)
  currencyCode: Int
}

-- Daily budgets (historical)
UserDailyBudget {
  userId: String (foreign key)
  date: DateTime
  limit: Int (daily budget limit)
  spent: Int (actual spending)
  balance: Int (remaining)
}
```

## 🔐 Security Architecture

### Authentication Flow
```
User → /api/auth/signin → NextAuth → JWT Token → All Protected Routes
```

### Security Layers
1. **Transport**: HTTPS with HSTS
2. **Authentication**: JWT tokens (30-day expiry)
3. **Rate Limiting**: 5 req/min for auth, 100 req/min for API
4. **Data Protection**: Encrypted tokens, user isolation
5. **Input Validation**: Zod schemas + TypeScript

## 📊 State Management

### Zustand Store Structure
```typescript
interface BudgetStore {
  // User data
  user: User | null;
  settings: UserSettings;
  
  // Financial data
  monthBudget: MonthBudget | null;
  transactions: Transaction[];
  excludedTransactionIds: string[];
  
  // UI state
  selectedDate: Date | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setMonthBudget: (budget: MonthBudget) => void;
  addTransactions: (transactions: Transaction[]) => void;
  setSettings: (settings: Partial<UserSettings>) => void;
}
```

### Persistence Strategy
- **Online**: PostgreSQL via API routes
- **Offline**: IndexedDB for transactions
- **Settings**: localStorage for quick access
- **Sync**: Automatic background sync every 5 minutes

## 🔄 Data Sync Patterns

### Monobank Integration
```typescript
// Historical data loading
syncHistoricalData(userId: string, months: number): Promise<void>

// Daily background sync
refreshTodayTransactions(): Promise<Transaction[]>

// Rate limiting: 61 seconds between requests
// Data format: Unix timestamps, amounts in kopecks
```

### Transaction Categories
```typescript
// MCC (Merchant Category Code) mapping
const CATEGORY_MAPPING = {
  5411: "Groceries",
  5812: "Restaurants",
  4011: "Transport",
  4812: "Utilities",
  // ... 100+ categories mapped
};

// Custom categories supported
interface CustomCategory {
  id: string;
  name: string;
  transactionIds: string[];
}
```

## 🎨 UI Components

### Budget Calendar
- **Financial month support**: Custom start day (1-31)
- **Daily budget display**: Spent vs limit with progress bars
- **Navigation**: By financial months, not calendar months
- **Visual feedback**: Color coding for budget status

### Settings Panel
- **Monobank integration**: Token management, account selection
- **Financial month**: Calendar picker for start day
- **AI settings**: Toggle for intelligent budget distribution
- **Historical data**: Load and manage transaction history

### Day Detail Modal
- **Transaction list**: All transactions for selected day
- **Category editing**: Reassign transaction categories
- **Comments**: Add notes to transactions
- **Exclusions**: Mark transactions as excluded from budget

## 🚨 Common Issues & Solutions

### Issue: Historical budgets changing
```typescript
// Problem: Past days budget changes when total budget changes
// Solution: Use saved historical limits for past days
const historicalBudget = historicalBudgets.get(dateKey);
if (historicalBudget) {
  limit = historicalBudget.limit; // Use saved value
} else {
  limit = baseDailyLimit; // Fallback for new days
}
```

### Issue: Uneven AI budget distribution
```typescript
// Problem: AI creates very different daily limits
// Solution: Apply smoothing to prevent extreme variations
weight = Math.max(0.3, Math.min(3.0, weight));
```

### Issue: Financial month navigation problems
```typescript
// Problem: Calendar navigation uses calendar months
// Solution: Navigate by financial months
const goToNextMonth = () => {
  setSelectedFinancialMonth(prev => {
    const newDate = new Date(prev);
    newDate.setDate(newDate.getDate() + 30); // Approximate month
    return newDate;
  });
};
```

## 🧪 Testing Guidelines

### Unit Test Patterns
```typescript
// Budget calculations
describe('distributeBudget', () => {
  test('handles empty transactions', () => {
    // Test edge cases
  });
  
  test('respects historical budgets', () => {
    // Test past day handling
  });
});

// AI distribution
describe('AI Budget Distribution', () => {
  test('analyzes spending patterns correctly', () => {
    // Test pattern recognition
  });
});
```

### Integration Test Patterns
```typescript
// API endpoints
describe('/api/ai/budget-distribution', () => {
  test('returns AI-generated budgets', async () => {
    const response = await POST(request);
    expect(response.dailyBudgets).toBeDefined();
  });
});

// Components
describe('BudgetCalendar', () => {
  test('navigates financial months correctly', () => {
    // Test month navigation
  });
});
```

## 📈 Performance Optimization

### Frontend Optimizations
- **React.memo**: Prevent unnecessary re-renders
- **useMemo**: Cache expensive calculations
- **useCallback**: Stable function references
- **Virtual scrolling**: For large transaction lists

### Backend Optimizations
- **Prisma connection pooling**: Single instance
- **Rate limiting caching**: In-memory sliding window
- **Database indexes**: On userId, date, transactionId
- **API response caching**: For static data

## 🔧 Development Workflow

### Environment Setup
```bash
# Dependencies
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Database Operations
```bash
npx prisma generate   # Generate client
npx prisma db push    # Push schema changes
npx prisma studio     # Open database GUI
```

### Deployment
```bash
git push origin main   # Deploy to Railway (automatic)
# Railway handles: build → migrate → start
```

## 🎯 AI Assistant Guidelines

### When Working on This Project

1. **Always check existing patterns** before creating new ones
2. **Respect financial month logic** in all date calculations
3. **Use TypeScript strictly** - no `any` types
4. **Follow the existing code style** - Tailwind classes, component patterns
5. **Test edge cases** - month boundaries, leap years, empty data
6. **Consider offline functionality** - IndexedDB, error handling
7. **Maintain security** - user isolation, input validation
8. **Optimize for performance** - caching, memoization
9. **Document changes** - update relevant documentation
10. **Test thoroughly** - unit tests, integration tests, manual testing

### Quick Reference Commands
```typescript
// Common imports
import { useBudgetStore } from "@/store/budget-store";
import { distributeBudget } from "@/lib/budget-ai";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

// Common patterns
const { settings, transactions } = useBudgetStore();
const financialDayStart = settings.financialMonthStart || 1;
const isCurrentFinancialMonth = /* calculation */;

// API route pattern
export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  // ... route logic
}
```

This reference should help AI assistants quickly understand and work effectively with the Burn Rate Calendar codebase.
