# Updated Architecture Overview

## 🏗️ Current System Architecture (2026-01-04)

This document reflects the latest state of the Burn Rate Calendar project including recent AI and financial month enhancements.

## 📊 Data Flow Architecture

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ (1) SignIn + Password + Settings
         ↓
┌─────────────────────────────────────┐
│      NextAuth Middleware            │
│ (JWT Verification + Rate Limiting)  │
└────────┬────────────────────────────┘
         │ (2) JWT Valid → Proceed
         ↓
    ┌────────────────────────────────────────┐
    │  Next.js API Routes / Pages            │
    ├────────────────────────────────────────┤
    │  Auth Routes: Credentials provider     │
    │  DB Routes: CRUD per user              │
    │  Mono Routes: Token proxy to Monobank  │
    │  AI Routes: Budget distribution        │ ← NEW
    └────────┬───────────────────────────────┘
             │
    ┌────────┴────────────────────────────────────┐
    ├────────────────────────────────────────────┬┴──────┐
    ↓                                            ↓       ↓
┌─────────────┐                         ┌────────────────┐  ┌──────────────┐
│  Prisma ORM │                         │ Zustand Store  │  │ IndexedDB    │
│             │                         │ (Client State) │  │ (Offline)    │
└────────┬────┘                         └────────────────┘  └──────────────┘
         ↓
┌─────────────────────────────────────────┐
│      PostgreSQL (Railway)               │
│ ├── Users (auth data)                   │
│ ├── UserSettings (encrypted tokens)     │
│ ├── UserTransactions (per-user data)    │
│ ├── UserExcludedTransactions            │
│ ├── UserDailyBudgets (historical)      │ ← NEW
│ └── TransactionComments (user notes)    │ ← NEW
└─────────────────────────────────────────┘
```

## 🤖 AI Budget Distribution System

### AI Integration Points
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Settings │    │  Historical Data │    │  AI Engine     │
│ - useAIBudget │───▶│ - Last 90 txns  │───▶│ - Pattern       │
│ - financialDay │    │ - Categories     │    │   Analysis      │
└─────────────────┘    └──────────────────┘    │ - Weight        │
                                              │   Calculation  │
                                              └────────┬────────┘
                                                       │
┌───────────────────────────────────────────────────────┴────────┐
│                    distributeBudget() Function              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Load historical budgets (past days)               │
│ 2. Call AI endpoint if useAI=true                      │
│ 3. Fallback to traditional distribution if AI fails    │
│ 4. Generate DayBudget[] with confidence/reasoning     │
└─────────────────────────────────────────────────────────────────┘
```

### AI Algorithm Flow
```
Input: Last 90 transactions + current balance
  ↓
Pattern Recognition:
  - Day-of-week spending analysis
  - Category spending patterns (MCC codes)
  - Seasonal factor calculations
  ↓
Weight Calculation:
  - Base weight = 1.0
  - Adjust by historical spending patterns
  - Apply smoothing (0.3 - 3.0 range)
  ↓
Confidence Scoring:
  - Data confidence (transaction count)
  - Pattern consistency (variance analysis)
  - Overall confidence (0-1)
  ↓
Output: Daily limits with explanations
```

## 🗓️ Financial Month System

### Financial Month Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Settings │    │  Calendar State │    │  Display Logic │
│ - financialDay │───▶│ - selectedDate  │───▶│ - Month Label   │
│ - start day    │    │ - isCurrent     │    │ - Navigation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                              │
┌───────────────────────────────────────────────────────┴────────┐
│                    Budget Calendar Component                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Calculate financial month boundaries                       │
│ 2. Display calendar grid with financial month highlighting    │
│ 3. Navigate by financial months (not calendar months)       │
│ 4. Apply visual styling for financial vs non-financial days │
└─────────────────────────────────────────────────────────────────┘
```

### Financial Month Calculations
```typescript
// Core functions (NEW)
getFinancialMonthStart(date, financialDayStart) → Date
getFinancialMonthEnd(date, financialDayStart) → Date  
getFinancialMonthDays(date, financialDayStart) → Date[]
getFinancialMonthLabel(date, financialDayStart) → string

// Example: financialDayStart = 5, today = Jan 4
// Current financial month: Dec 5 - Jan 4
// Next financial month: Jan 5 - Feb 4
```

## 🗄️ Updated Database Schema

### New Tables Added
```sql
-- Historical daily budgets (NEW)
UserDailyBudget {
  userId: String (foreign key)
  date: DateTime (unique per user)
  limit: Int (daily budget limit in kopecks)
  spent: Int (actual spending)
  balance: Int (remaining budget)
  createdAt: DateTime
  updatedAt: DateTime
}

-- Transaction comments (NEW)  
TransactionComment {
  userId: String (foreign key)
  transactionId: String (foreign key)
  comment: String
  createdAt: DateTime
  updatedAt: DateTime
}

-- Enhanced UserSettings (UPDATED)
UserSettings {
  userId: String (foreign key)
  monoToken: String (encrypted)
  accountId: String
  accountBalance: Int
  accountCurrency: Int
  financialMonthStart: Int (NEW) -- Day 1-31
  useAIBudget: Boolean (NEW)    -- Enable AI distribution
  transactionComments: Json (NEW) -- Map<transactionId, comment>
}
```

## 🔧 Enhanced Component Architecture

### Budget Calendar Component (UPDATED)
```typescript
interface BudgetCalendarProps {
  dailyLimits: DayBudget[]; // Enhanced with AI data
  onDayClick?: (day: DayBudget) => void;
}

interface DayBudget (ENHANCED) {
  date: Date;
  limit: number;
  spent: number;
  remaining: number;
  transactions: Transaction[];
  status: "under" | "warning" | "over";
  confidence?: number;    // NEW: AI confidence (0-1)
  reasoning?: string;    // NEW: AI explanation
}

// State management (UPDATED)
const [selectedFinancialMonth, setSelectedFinancialMonth] = useState(new Date());
const { settings } = useBudgetStore();
const financialDayStart = settings.financialMonthStart || 1;
const isCurrentFinancialMonth = /* financial month comparison */;
```

### Settings Panel Component (ENHANCED)
```typescript
// NEW: Financial month settings
<div className="financial-month-settings">
  <Label>Початок фінансового місяця</Label>
  <Calendar
    mode="single"
    selected={new Date().setDate(settings.financialMonthStart || 1)}
    onSelect={(date) => setSettings({ financialMonthStart: date.getDate() })}
  />
</div>

// NEW: AI budget settings
<div className="ai-budget-settings">
  <Label className="flex items-center gap-2">
    <Brain className="w-4 h-4" />
    AI-розподіл бюджету
  </Label>
  <Checkbox
    checked={settings.useAIBudget ?? true}
    onChange={(e) => setSettings({ useAIBudget: e.target.checked })}
  />
</div>
```

### Day Detail Modal Component (ENHANCED)
```typescript
// NEW: Transaction comments
interface TransactionComment {
  transactionId: string;
  comment: string;
}

// Comment editing functionality
const [editingComment, setEditingComment] = useState<string>("");
const saveComment = async (transactionId: string, comment: string) => {
  await fetch("/api/db/transaction-comments", {
    method: "POST",
    body: JSON.stringify({ transactionId, comment })
  });
};
```

## 🚀 API Routes Architecture

### New AI Endpoints
```typescript
// AI Budget Distribution (NEW)
POST /api/ai/budget-distribution
Input: BudgetRequest {
  totalBudget: number,
  currentBalance: number,
  transactions: TransactionData[],
  startDate: string,
  endDate: string,
  financialMonthStart?: number
}
Output: {
  dailyBudgets: DayBudget[],
  analysis: SpendingAnalysis,
  usedBudget: number,
  totalDays: number
}

// Transaction Comments (NEW)
POST /api/db/transaction-comments
GET /api/db/transaction-comments
```

### Enhanced Database Endpoints
```typescript
// Daily Budgets (ENHANCED)
POST /api/db/daily-budgets
- Save future daily budgets to preserve historical data
- Upsert operation (create or update)

GET /api/db/daily-budgets?userId=X&from=Y&to=Z
- Retrieve historical budgets for date range
- Used by AI for pattern analysis
```

## 🔐 Enhanced Security Architecture

### Security Layers (UPDATED)
```
Layer 1: Transport
├── HTTPS enforced (HSTS in production)
├── CSP restricts external resources
└── X-Frame-Options: DENY

Layer 2: Authentication  
├── JWT tokens with 30-day expiry
├── Credentials provider (no OAuth)
└── Automatic registration on first login

Layer 3: Rate Limiting (UPDATED)
├── AUTH endpoints: 5 requests/minute
├── API endpoints: 100 requests/minute  
├── AI endpoints: 10 requests/minute (NEW)
├── READ operations: 300 requests/minute
└── SENSITIVE ops: 3 requests/5 minutes

Layer 4: Data Protection
├── Passwords: scrypt hash + random salt
├── Monobank tokens: AES-256-GCM encrypted
├── User isolation: All queries include userId
└── Historical budgets: Per-user isolation (NEW)

Layer 5: Input Validation (ENHANCED)
├── Zod schemas on all API inputs
├── Max lengths enforced
├── Type checking with TypeScript
└── AI input validation (NEW)
```

## 📈 Performance Optimizations (UPDATED)

### Frontend Optimizations
- **React Compiler**: Automatic memoization
- **Server Components**: Default in App Router
- **Zustand persistence**: localStorage for quick load
- **IndexedDB**: Offline transaction access
- **Rate limit caching**: In-memory sliding window
- **Prisma connection pooling**: Single instance via singleton
- **AI result caching**: Cache AI predictions by parameters (NEW)

### Backend Optimizations
- **Database indexes**: On userId, date, transactionId
- **AI endpoint optimization**: < 2 second response time (NEW)
- **Historical budget caching**: In-memory for frequent access (NEW)

## 🔄 Updated Sync Patterns

### Enhanced Transaction Sync (UPDATED)
```
Initial Historical Load:
1. User clicks "Load Historical Data"
2. mono-sync.ts: syncHistoricalData()
3. For each month (12 total):
   a. Wait 61s (Monobank rate limit)
   b. Fetch /api/mono/statement  
   c. Store in IndexedDB
   d. Update progress callback
4. Set historicalDataLoaded flag
5. Recalculate budget with AI distribution (NEW)

Daily Background Sync:
1. Component mounts → 5-minute interval
2. Clear today's transactions
3. Fetch today's data for all accounts
4. Small delay (100ms) between accounts
5. Update IndexedDB + Zustand store
6. Recalculate budget with AI if enabled (NEW)
```

## 🧪 Testing Strategy (ENHANCED)

### New Test Categories
```typescript
// AI Budget Distribution Tests (NEW)
describe('AI Budget Distribution', () => {
  test('analyzes spending patterns correctly', () => {
    // Test day-of-week pattern recognition
  });
  
  test('generates appropriate confidence scores', () => {
    // Test confidence calculation logic
  });
  
  test('handles insufficient data gracefully', () => {
    // Test fallback to traditional distribution
  });
});

// Financial Month Tests (NEW)
describe('Financial Month System', () => {
  test('calculates financial month boundaries correctly', () => {
    // Test edge cases (month boundaries, leap years)
  });
  
  test('navigates by financial months not calendar months', () => {
    // Test navigation logic
  });
});

// Historical Budget Tests (NEW)
describe('Historical Budget Preservation', () => {
  test('preserves past day budgets when total budget changes', () => {
    // Test historical budget immutability
  });
});
```

## 🎯 Current Project Status

### Completed Features ✅
- **AI Budget Distribution**: Rule-based AI with pattern analysis
- **Financial Months**: Custom start day with proper navigation
- **Historical Budgets**: Daily budget persistence and retrieval
- **Transaction Comments**: User notes on transactions
- **Enhanced UI**: Settings for AI and financial months
- **Error Handling**: Comprehensive fallback mechanisms

### Recent Improvements 🆕
- Fixed historical budget preservation (Jan 4, 2026)
- Enhanced AI endpoint with detailed logging
- Improved financial month navigation and display
- Added confidence scoring and reasoning to AI results
- Fixed calendar display for custom financial months

### Technical Debt ⚠️
- Consider replacing rule-based AI with ML models
- Optimize database queries for large datasets
- Add comprehensive error recovery mechanisms
- Implement automated testing pipeline

This architecture overview provides current system state for quick AI orientation and development context.
