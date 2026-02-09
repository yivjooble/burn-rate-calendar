# Burn Rate Calendar

Personal finance tracker with Monobank integration. Track your daily spending against your budget.

## ✨ Features

### Real-time Multi-device Sync (v2.0.0)
- 🔄 **Auto-refresh** - Data updates every 10 seconds automatically
- 📱 **Multi-device** - Same data on phone, tablet, and desktop
- ⚡ **Optimistic UI** - Instant updates without waiting for server
- 🔔 **Toast notifications** - User-friendly error messages
- 🎨 **Loading states** - Smooth skeleton screens

### Budget Management
- 📊 Track daily/monthly spending against budget
- 💳 Monobank integration for automatic transaction sync
- 📈 Visual charts and progress indicators

## 🏗️ Architecture

### Frontend
- Next.js 16.1.1 (App Router)
- SWR 2.2.5 (data fetching & caching)
- Sonner 1.4.0 (toast notifications)
- Tailwind CSS 4 (styling)

### Backend
- PostgreSQL (Prisma ORM)
- NextAuth.js v5 (authentication)
- Monobank API (transaction sync)

### Real-time Architecture
```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Browser   │────▶│  SWR Cache   │────▶│   API    │
│  (Client)   │◀────│  (10s poll)  │◀────│ Endpoints│
└─────────────┘     └──────────────┘     └──────────┘
      │                                         │
      │             Optimistic Updates          │
      └─────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Database**: PostgreSQL (via Prisma ORM)
- **Auth**: NextAuth.js v5
- **Styling**: TailwindCSS 4

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)

### Setup

1. **Clone and install dependencies**:
   ```bash
   cd burn-rate-calendar
   npm install
   ```

2. **Start PostgreSQL** (via Docker):
   ```bash
   docker run --name burn-rate-pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=burn_rate -p 5432:5432 -d postgres:15
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values:
   # - DATABASE_URL=postgresql://postgres:password@localhost:5432/burn_rate
   # - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
   # - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
   ```

4. **Initialize database**:
   ```bash
   npx prisma db push
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Railway

### Quick Deploy

1. **Create Railway project** and add PostgreSQL plugin
2. **Connect your GitHub repo**
3. **Set environment variables** in Railway dashboard:
   - `DATABASE_URL` — auto-populated by Railway PostgreSQL plugin
   - `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Railway app URL (e.g., `https://your-app.up.railway.app`)

4. **Deploy** — Railway will auto-detect Next.js and run:
   ```bash
   npm install  # triggers prisma generate via postinstall
   npm run build
   npm start
   ```

### Database Migrations

For schema changes, run locally then push:
```bash
npx prisma db push
```

Or use migrations for production:
```bash
npx prisma migrate dev --name your_migration_name
npx prisma migrate deploy  # in production
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `ENCRYPTION_KEY` | ✅ | 32-byte hex key for encrypting Monobank tokens |
| `NEXTAUTH_SECRET` | ✅ | Secret for JWT signing |
| `NEXTAUTH_URL` | ✅ (prod) | Your app's public URL |
| `NEXT_PUBLIC_FEATURE_SWR_BUDGET` | ❌ | Enable SWR for budget (default: true) |
| `NEXT_PUBLIC_FEATURE_SWR_SETTINGS` | ❌ | Enable SWR for settings (default: true) |
| `NEXT_PUBLIC_FEATURE_SWR_CATEGORIES` | ❌ | Enable SWR for categories (default: true) |
| `NEXT_PUBLIC_FEATURE_OPTIMISTIC` | ❌ | Enable optimistic UI updates (default: true) |
| `NEXT_PUBLIC_FEATURE_REALTIME` | ❌ | Enable real-time sync (default: true) |

### Feature Flags (v2.0.0)

Control feature behavior via environment variables:
```bash
# Enable/disable specific features
NEXT_PUBLIC_FEATURE_SWR_BUDGET=true    # SWR for budget data
NEXT_PUBLIC_FEATURE_SWR_SETTINGS=true  # SWR for user settings
NEXT_PUBLIC_FEATURE_SWR_CATEGORIES=true # SWR for categories
NEXT_PUBLIC_FEATURE_OPTIMISTIC=true    # Instant UI feedback
NEXT_PUBLIC_FEATURE_REALTIME=true      # 10s auto-refresh
```

## 📚 Documentation

- [Deployment Flow](memory/brc-deployment-flow.md)
- [Migration Guide](docs/MIGRATION.md)
- [Release Notes](RELEASE_NOTES.md)

## Security

- Monobank tokens encrypted at rest (AES-256-GCM)
- Passwords hashed with scrypt (OWASP 2024 guidelines)
- HTTPS enforced via HSTS in production
- CSP headers configured
