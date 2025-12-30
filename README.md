# Burn Rate Calendar

Personal finance tracker with Monobank integration. Track your daily spending against your budget.

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

## Security

- Monobank tokens encrypted at rest (AES-256-GCM)
- Passwords hashed with scrypt (OWASP 2024 guidelines)
- HTTPS enforced via HSTS in production
- CSP headers configured
