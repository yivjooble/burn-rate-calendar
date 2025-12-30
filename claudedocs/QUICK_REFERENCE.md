# Quick Reference

## Common Tasks

### Add New API Endpoint
1. Create `src/app/api/[name]/route.ts`
2. Export async functions: `GET`, `POST`, `PUT`, `DELETE`
3. Use `getUserIdFromRequest()` for auth
4. Add Zod validation in `src/lib/validation.ts`
5. Add rate limiting via middleware

### Add New Component
1. Create `src/components/[name].tsx`
2. Use "use client" directive if needed
3. Import from `@/components/ui/*` for primitives
4. Add to page or parent component

### Modify Database Schema
1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push` (dev)
3. Or `npx prisma migrate dev --name [name]` (prod)
4. Update TypeScript types in `src/types/index.ts`

### Add New Setting
1. Add key to `settingKeySchema` in `src/lib/validation.ts`
2. If sensitive, add to `SENSITIVE_KEYS` in `src/lib/db.ts`
3. Add to Zustand store if needed
4. Update UI in `settings-panel.tsx`

### Add New MCC Category
1. Edit `src/lib/mcc-categories.ts`
2. Add category definition with icon, color, MCC ranges
3. Update `getCategoryForMcc()` function

## File Locations

| What | Where |
|------|-------|
| Auth config | `src/auth.ts` |
| Middleware | `src/middleware.ts` |
| Database operations | `src/lib/db.ts` |
| Prisma client | `src/lib/prisma.ts` |
| Encryption | `src/lib/crypto.ts` |
| Validation schemas | `src/lib/validation.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Monobank API | `src/lib/monobank.ts` |
| Transaction sync | `src/lib/mono-sync.ts` |
| Budget algorithm | `src/lib/budget-ai.ts` |
| MCC categories | `src/lib/mcc-categories.ts` |
| Zustand store | `src/store/budget-store.ts` |
| TypeScript types | `src/types/index.ts` |

## Key Types

```typescript
// Transaction
interface Transaction {
  id: string
  time: number          // Unix timestamp
  description: string
  mcc: number           // Merchant Category Code
  amount: number        // In kopiyky (cents), negative = expense
  balance: number
  cashbackAmount: number
  currencyCode: number  // ISO 4217 (980=UAH)
  comment?: string
}

// User Settings
interface UserSettings {
  monoToken: string     // Encrypted Monobank API token
  monthlyBudget: number
  accountId: string     // Primary account
  selectedAccountIds: string[]
  selectedAccountCurrencies: number[]
  historicalDataLoaded: boolean
}

// Day Budget
interface DayBudget {
  date: Date
  limit: number
  spent: number
  remaining: number
  status: 'under' | 'warning' | 'over'
  transactions: Transaction[]
}
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
ENCRYPTION_KEY=64-char-hex-string
NEXTAUTH_SECRET=random-32-char-string
NEXTAUTH_URL=http://localhost:3000  # or production URL
```

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run ESLint
npx prisma studio        # Database GUI
npx prisma db push       # Sync schema

# Production
npm run build            # Build for production
npm start                # Start production server
npx prisma migrate deploy  # Run migrations

# Generate keys
openssl rand -hex 32     # ENCRYPTION_KEY
openssl rand -base64 32  # NEXTAUTH_SECRET
```

## API Quick Reference

### Auth
```
POST /api/auth/signin
Body: { email, password }
Response: JWT token (in cookie)

POST /api/auth/signout
Response: Session cleared
```

### Settings
```
GET /api/db/settings
Headers: Cookie with JWT
Response: { settings: Record<string, string> }

POST /api/db/settings
Headers: Cookie with JWT
Body: { key: string, value: string }
Response: { success: true }
```

### Transactions
```
GET /api/db/transactions
Headers: Cookie with JWT
Response: { transactions: Transaction[] }

POST /api/db/transactions
Headers: Cookie with JWT
Body: { transactions: Transaction[] }
Response: { success: true }
```

### Monobank
```
GET /api/mono/client-info
Headers: x-token (Monobank API token)
Response: Monobank ClientInfo

GET /api/mono/statement?account=X&from=Y&to=Z
Headers: x-token
Response: Transaction[]

GET /api/mono/currency
Response: CurrencyRate[]
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/* | 5 | 1 minute |
| /api/db/* | 100 | 1 minute |
| /api/mono/* | 100 | 1 minute |
| Monobank API | 1 | 61 seconds |

## Security Checklist

- [ ] All API routes check JWT via middleware
- [ ] Sensitive settings encrypted with AES-256-GCM
- [ ] Passwords hashed with scrypt
- [ ] Rate limiting on all endpoints
- [ ] OWASP headers in middleware
- [ ] User ID isolation on all queries
- [ ] Zod validation on all inputs
