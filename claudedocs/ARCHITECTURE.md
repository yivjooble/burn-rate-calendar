# Architecture Deep Dive

## Data Flow

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ (1) SignIn + Password
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
│ └── UserExcludedTransactions            │
└─────────────────────────────────────────┘
```

## Authentication Flow

1. User submits email/password to `/api/auth/signin`
2. NextAuth Credentials provider validates:
   - Find user by email OR create new user
   - Hash password with scrypt + salt
   - Compare with stored hash (timing-safe)
3. On success: JWT token issued (30-day expiry)
4. Middleware checks JWT on all protected routes
5. Rate limiting: 5 requests/min for auth endpoints

## Transaction Sync Flow

### Initial Historical Load
```
1. User clicks "Load Historical Data"
2. mono-sync.ts: syncHistoricalData()
3. For each month (12 total):
   a. Wait 61s (Monobank rate limit)
   b. Fetch /api/mono/statement
   c. Store in IndexedDB
   d. Update progress callback
4. Set historicalDataLoaded flag
5. Recalculate budget distribution
```

### Daily Background Sync
```
1. Component mounts → 5-minute interval
2. Clear today's transactions
3. Fetch today's data for all accounts
4. Small delay (100ms) between accounts
5. Update IndexedDB + Zustand store
6. Recalculate budget
```

## Budget Calculation

### distributeBudget() Algorithm
```
Input: monthlyBudget, transactions, excludedIds
Output: Array of DayBudget objects

1. Filter expenses (negative, not internal)
2. Analyze spending patterns:
   - weekdayAverage: Mon-Fri average
   - weekendAverage: Sat-Sun average
   - dayOfMonthMultipliers: 0-30 index
3. For each day of month:
   Past days:
   - spent = sum of day's expenses
   - limit = monthlyBudget / daysInMonth
   - status = spent < 80% ? "under" : spent < 100% ? "warning" : "over"

   Future days:
   - remaining = monthlyBudget - totalSpent
   - weight = weekday/weekend + dayOfMonth multiplier
   - limit = remaining * (weight / totalWeight)
```

### predictInflation() Algorithm
```
Input: transactions, currentBalance
Output: 12-month projection

1. Calculate monthly burn rate (average of last 3 months)
2. Project balance for each future month
3. Find months until balance reaches 0
4. Calculate confidence based on variance
   - High variance → low confidence (0.3)
   - Low variance → high confidence (0.95)
```

## Security Layers

### Layer 1: Transport
- HTTPS enforced (HSTS in production)
- CSP restricts external resources
- X-Frame-Options: DENY

### Layer 2: Authentication
- JWT tokens with 30-day expiry
- Credentials provider (no OAuth)
- Automatic registration on first login

### Layer 3: Rate Limiting
```
AUTH endpoints: 5 requests/minute
API endpoints: 100 requests/minute
READ operations: 300 requests/minute
SENSITIVE ops: 3 requests/5 minutes
```

### Layer 4: Data Protection
- Passwords: scrypt hash + random salt
- Monobank tokens: AES-256-GCM encrypted
- User isolation: All queries include userId

### Layer 5: Input Validation
- Zod schemas on all API inputs
- Max lengths enforced
- Type checking with TypeScript

## Multi-Currency Support

```typescript
// Supported currencies (ISO 4217)
UAH = 980  // Ukrainian Hryvnia (default)
USD = 840  // US Dollar
EUR = 978  // Euro
GBP = 826  // British Pound
PLN = 985  // Polish Zloty

// Conversion
convertToUAH(amount, currencyCode, rates) {
  rate = rates.find(r => r.currencyCodeA === currencyCode)
  return amount * (rate.rateCross || rate.rateSell || rate.rateBuy)
}
```

## MCC Category Mapping

| MCC Range | Category |
|-----------|----------|
| 5411-5499 | Groceries |
| 5812-5814 | Restaurants |
| 4011-4789, 5511-5599 | Transport |
| 4812-4900 | Utilities |
| 7832-7841, 7911-7999 | Entertainment |
| 5200-5999 | Shopping |
| 8011-8099 | Health |
| 8211-8299 | Education |
| 3000-3999, 7011-7033 | Travel |
| 7210-7399, 8111-8999 | Services |

## Internal Transfer Detection

Heuristics in `isInternalTransfer()`:
1. Keywords: "з білої картки", "на білу картку", "власні кошти"
2. Savings: "депозит", "накопичення", "оренда банки"
3. ATM withdrawals
4. Exact opposite amount on same day

## Error Handling Strategy

### API Responses
```
200 OK: Success with data
400 Bad Request: Validation error (details in message)
401 Unauthorized: Missing/invalid JWT
429 Too Many Requests: Rate limit (Retry-After header)
500 Internal Server Error: Database/processing failure
```

### Client-Side
```
Zustand store.error: User-facing message
Console logging: Development only
Retry logic: None (user must refresh)
```

## Performance Optimizations

1. **React Compiler**: Automatic memoization
2. **Server Components**: Default in App Router
3. **Zustand persistence**: localStorage for quick load
4. **IndexedDB**: Offline transaction access
5. **Rate limit caching**: In-memory sliding window
6. **Prisma connection pooling**: Single instance via singleton
