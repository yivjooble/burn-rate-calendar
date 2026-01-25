# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prisma generate first)
npm run lint             # Run ESLint

# Testing
npm run test             # Run tests with Vitest
npm run test:ui          # Run tests with interactive UI
npm run test:coverage    # Run tests with coverage report (70% thresholds)

# Database
npx prisma db push       # Sync schema to database
npx prisma studio        # Open database GUI
npx prisma generate      # Generate Prisma client

# Single test file
npx vitest run src/lib/budget-ai.test.ts
```

## Architecture

### Tech Stack
- **Next.js 16** with App Router and React 19
- **PostgreSQL** with Prisma ORM
- **NextAuth v5** (beta) with Credentials provider
- **Zustand** for client state + **localStorage** persistence
- **TailwindCSS 4** + **Radix UI** components

### Data Flow
```
User → NextAuth Middleware (JWT + Rate Limiting) → API Routes → Prisma → PostgreSQL
                                                       ↓
                                              Zustand Store ←→ localStorage
```

### Key Directories
- `src/app/api/auth/` - Auth routes (login, register, 2FA, password reset)
- `src/app/api/db/` - Database CRUD (settings, transactions, excluded, daily-budgets)
- `src/app/api/mono/` - Monobank API proxy (client-info, statement, currency)
- `src/lib/` - Core business logic
- `src/store/` - Zustand state management
- `src/components/ui/` - Shadcn primitives (don't modify directly)

### Multi-Tenant Architecture
All user data is isolated via `userId` foreign keys:
- `UserSetting` - key/value pairs (composite PK: userId + key)
- `UserTransaction` - transactions with `odataId` from Monobank
- `UserExcludedTransaction` - transactions excluded from budget
- `UserDailyBudget` - computed daily limits

### Core Business Logic (`src/lib/`)
- **budget-ai.ts** - `distributeBudget()` for daily allocation, `predictInflation()` for 12-month projection
- **monobank.ts** - API client, `isExpense()`, `isInternalTransfer()` heuristics, currency conversion
- **mono-sync.ts** - Historical sync with 61-second rate limit handling
- **mcc-categories.ts** - 15 categories mapped from MCC codes
- **crypto.ts** - AES-256-GCM encryption for Monobank tokens
- **rate-limit.ts** - Sliding window: auth 5/min, api 100/min

### Security Implementation
- Passwords: scrypt with random salt
- Monobank tokens: encrypted at rest (AES-256-GCM)
- 2FA: TOTP with encrypted secrets, backup codes
- Rate limiting in middleware for auth and API endpoints

### State Management
`useBudgetStore` (Zustand with persist middleware):
- Settings, transactions, budget calculations stored in store
- `initFromDb()` loads from PostgreSQL on mount
- Actions auto-sync to DB via fetch calls
- `monoToken` never persisted to localStorage (encrypted in DB only)

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 64-char hex for AES (generate: `openssl rand -hex 32`)
- `NEXTAUTH_SECRET` - JWT signing secret (generate: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Production URL (not needed for localhost)

## Currency Codes (ISO 4217)
- 980 = UAH (default)
- 840 = USD
- 978 = EUR

## API Response Patterns
- `200` - Success with data
- `400` - Validation error (check Zod schemas in `src/lib/validation.ts`)
- `401` - Missing/invalid JWT
- `429` - Rate limited (check Retry-After header)
