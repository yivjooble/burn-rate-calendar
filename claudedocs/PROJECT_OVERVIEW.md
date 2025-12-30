# Burn Rate Calendar - Project Overview

Personal finance tracker with Monobank integration for daily spending monitoring.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.1 + React 19.2.3 |
| Database | PostgreSQL + Prisma 6.1.0 |
| Auth | NextAuth v5 (beta.30), Credentials provider |
| State | Zustand 5.0.9 + IndexedDB |
| Styling | TailwindCSS 4 + Radix UI |
| Validation | Zod 4.2.1 |
| Security | AES-256-GCM, scrypt, rate limiting |

## Directory Structure

```
burn-rate-calendar/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # NextAuth routes
│   │   │   ├── db/                   # Database CRUD
│   │   │   │   ├── settings/         # User settings
│   │   │   │   ├── transactions/     # Transactions
│   │   │   │   ├── excluded/         # Excluded tracking
│   │   │   │   └── historical/       # Historical metadata
│   │   │   └── mono/                 # Monobank proxy
│   │   │       ├── client-info/      # Account info
│   │   │       ├── currency/         # Exchange rates
│   │   │       └── statement/        # Transaction history
│   │   ├── login/                    # Auth page
│   │   ├── page.tsx                  # Main dashboard
│   │   └── layout.tsx                # Root layout
│   ├── components/
│   │   ├── ui/                       # Shadcn primitives
│   │   ├── budget-calendar.tsx       # Monthly calendar
│   │   ├── budget-summary.tsx        # Monthly summary
│   │   ├── spending-chart.tsx        # Prediction chart
│   │   ├── settings-panel.tsx        # Configuration
│   │   ├── day-detail-modal.tsx      # Daily details
│   │   ├── categories-page.tsx       # Categorization
│   │   └── providers.tsx             # Client providers
│   ├── lib/
│   │   ├── db.ts                     # Database operations
│   │   ├── prisma.ts                 # Prisma singleton
│   │   ├── auth.ts                   # Auth config
│   │   ├── auth-utils.ts             # Auth helpers
│   │   ├── monobank.ts               # Monobank API
│   │   ├── mono-sync.ts              # Transaction sync
│   │   ├── mcc-categories.ts         # MCC categorization
│   │   ├── budget-ai.ts              # Budget algorithm
│   │   ├── crypto.ts                 # Encryption utils
│   │   ├── validation.ts             # Zod schemas
│   │   ├── rate-limit.ts             # Rate limiting
│   │   └── utils.ts                  # General utils
│   ├── store/
│   │   └── budget-store.ts           # Zustand store
│   └── types/
│       └── index.ts                  # TypeScript types
├── prisma/
│   └── schema.prisma                 # Database schema
└── data/                             # Static data files
```

## Database Schema

### User Models (Multi-tenant)
```
User: id, email, passwordHash, passwordSalt
  └── UserSetting: userId, key, value (composite PK)
  └── UserTransaction: id, userId, odataId, time, description, mcc, amount, balance, currencyCode
  └── UserExcludedTransaction: id, userId, odataId (composite PK)
```

### Key Fields
- `odataId`: Original Monobank transaction ID
- `mcc`: Merchant Category Code for categorization
- `currencyCode`: ISO 4217 (980=UAH, 840=USD, 978=EUR)
- Settings with sensitive keys are encrypted (monoToken)

## Core Features

### 1. Budget Distribution (`budget-ai.ts`)
- `distributeBudget()`: AI-based daily allocation
- Weekday/weekend pattern analysis
- Status: under/warning/over (80/100 thresholds)
- `predictInflation()`: 12-month projection

### 2. Transaction Processing (`monobank.ts`)
- `isExpense()`: Negative amount, not internal transfer
- `isInternalTransfer()`: Heuristic detection (keywords, ATM, opposite amounts)
- Multi-currency conversion via `convertToUAH()`

### 3. MCC Categorization (`mcc-categories.ts`)
15 categories: Groceries, Restaurants, Transport, Utilities, Entertainment, Shopping, Health, Education, Travel, Services, Mobile, Charity, Transfers, Cash, Other

### 4. Historical Sync (`mono-sync.ts`)
- 12-month historical load
- Monobank rate limits (1 req/61s)
- Multi-account support
- Progress tracking with callbacks

## Security Measures

| Feature | Implementation |
|---------|----------------|
| Auth | NextAuth v5 JWT, 30-day sessions |
| Passwords | scrypt + random salt, timing-safe compare |
| Token Storage | AES-256-GCM, env-derived key |
| Rate Limiting | Sliding window: auth 5/min, api 100/min |
| Headers | OWASP: CSP, HSTS, X-Frame-Options |
| Validation | Zod schemas on all inputs |

## API Endpoints

### Auth
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout

### Database (Protected)
- `GET/POST /api/db/settings` - User settings CRUD
- `GET/POST /api/db/transactions` - Transactions CRUD
- `GET/POST /api/db/excluded` - Excluded transactions
- `GET /api/db/historical` - Historical metadata

### Monobank Proxy (Token required)
- `GET /api/mono/client-info` - Account info
- `GET /api/mono/statement` - Transaction history
- `GET /api/mono/currency` - Exchange rates

## State Management (Zustand)

```typescript
BudgetStore {
  // Settings
  monoToken, monthlyBudget, accountId, selectedAccountIds, selectedAccountCurrencies

  // Data
  transactions, excludedTransactionIds, monthBudget, inflationPrediction
  customCategories, transactionCategories

  // Status
  isLoading, isHistoricalLoading, error, dbInitialized

  // Actions
  setSettings(), initFromDb(), syncToDb(), excludeTransaction()
}
```

Persistence: localStorage + PostgreSQL for sensitive data

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection |
| ENCRYPTION_KEY | Yes | 64-char hex for AES |
| NEXTAUTH_SECRET | Yes | JWT signing secret |
| NEXTAUTH_URL | Prod | Public app URL |

## Component Hierarchy

```
Layout → Providers → Page
  ├── Header (Logo, Tabs, Logout)
  └── Tab Content
      ├── Calendar: BudgetSummary + BudgetCalendar + DayDetailModal
      ├── Prediction: SpendingChart
      ├── Categories: CategoriesPage
      └── Settings: SettingsPanel
```

## Key Files for Common Tasks

| Task | Files |
|------|-------|
| Add API endpoint | `src/app/api/[folder]/route.ts` |
| Add component | `src/components/[name].tsx` |
| Modify schema | `prisma/schema.prisma` → `npx prisma db push` |
| Add validation | `src/lib/validation.ts` |
| Modify store | `src/store/budget-store.ts` |
| Add utility | `src/lib/[name].ts` |
| Change auth | `src/auth.ts`, `src/middleware.ts` |

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint check
npx prisma db push   # Sync schema to DB
npx prisma studio    # Database GUI
```

## Deployment (Railway)

1. PostgreSQL plugin → auto DATABASE_URL
2. Set ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL
3. Auto-detect: npm install → prisma generate → next build → next start
