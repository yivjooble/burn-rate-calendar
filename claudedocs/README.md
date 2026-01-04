# Burn Rate Calendar - AI Documentation Index

## 📚 Documentation Structure

This folder contains comprehensive documentation for AI assistants working on the Burn Rate Calendar project.

## 🗂️ File Index

### **[AI_QUICK_REFERENCE.md](./AI_QUICK_REFERENCE.md)**
- **Purpose**: Quick start guide for AI assistants
- **Content**: Essential context, common patterns, development guidelines
- **When to use**: First reference when working on this project
- **Key sections**: Project structure, core features, common issues, testing patterns

### **[UPDATED_ARCHITECTURE.md](./UPDATED_ARCHITECTURE.md)**
- **Purpose**: Current system architecture and data flow
- **Content**: Complete technical architecture with latest features
- **When to use**: Understanding system design and component interactions
- **Key sections**: AI integration, financial months, database schema, security

### **[AI_BUDGET_ARCHITECTURE.md](./AI_BUDGET_ARCHITECTURE.md)**
- **Purpose**: Deep dive into AI budget distribution system
- **Content**: Detailed AI algorithms, integration points, performance
- **When to use**: Working on budget calculation or AI features
- **Key sections**: AI endpoint, pattern analysis, confidence scoring, fallbacks

### **[FINANCIAL_MONTH_ARCHITECTURE.md](./FINANCIAL_MONTH_ARCHITECTURE.md)**
- **Purpose**: Complete financial month system documentation
- **Content**: Financial month calculations, navigation, edge cases
- **When to use**: Working on calendar or date-related features
- **Key sections**: Core functions, state management, display logic

### **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**
- **Purpose**: High-level project overview and goals
- **Content**: Business context, user stories, feature roadmap
- **When to use**: Understanding project purpose and direction
- **Key sections**: Problem statement, solution approach, success metrics

### **[ARCHITECTURE.md](./ARCHITECTURE.md)**
- **Purpose**: Original system architecture (legacy)
- **Content**: Initial technical design and data flow
- **When to use**: Understanding historical architecture decisions
- **Key sections**: Original patterns, security layers, performance

### **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**
- **Purpose**: Quick reference for common tasks
- **Content**: Code snippets, commands, patterns
- **When to use**: Quick lookup during development
- **Key sections**: Common operations, troubleshooting, tips

## 🎯 AI Assistant Usage Guide

### 🚀 First Steps
1. **Start with [AI_QUICK_REFERENCE.md]** - Essential context and patterns
2. **Check [UPDATED_ARCHITECTURE.md]** - Current system state
3. **Use specific docs** based on your task:
   - Budget/AI work → [AI_BUDGET_ARCHITECTURE.md]
   - Calendar/Date work → [FINANCIAL_MONTH_ARCHITECTURE.md]
   - Architecture decisions → [UPDATED_ARCHITECTURE.md]

### 📖 Recommended Reading Order

#### For New AI Assistants:
```
1. AI_QUICK_REFERENCE.md (5 min) → Quick context
2. UPDATED_ARCHITECTURE.md (10 min) → Current architecture  
3. PROJECT_OVERVIEW.md (5 min) → Business context
```

#### For Feature Development:
```
1. AI_QUICK_REFERENCE.md → Refresh on patterns
2. Specific architecture doc → Deep dive on feature
3. UPDATED_ARCHITECTURE.md → System integration
```

#### For Bug Fixes:
```
1. AI_QUICK_REFERENCE.md → Common issues and solutions
2. Specific architecture doc → Component details
3. QUICK_REFERENCE.md → Troubleshooting patterns
```

## 🔍 Key Information Sources

### 📁 Code Locations
```
src/
├── lib/budget-ai.ts              # AI budget distribution
├── components/budget-calendar.tsx  # Financial month calendar
├── components/settings-panel.tsx   # User settings
├── store/budget-store.ts          # Global state management
├── app/api/ai/budget-distribution/ # AI endpoint
└── types/index.ts                # TypeScript definitions
```

### 🗄️ Database Schema
```sql
-- Core tables for reference
User (authentication)
UserSettings (preferences + encrypted data)
UserTransaction (financial data)
UserDailyBudget (historical budgets)
TransactionComment (user notes)
```

### 🔧 Configuration Files
```
package.json                    # Dependencies and scripts
tailwind.config.js              # Styling configuration
next.config.js                 # Next.js configuration
prisma/schema.prisma           # Database schema
```

## ⚡ Quick Access Information

### 🎯 Core Functions
```typescript
// AI Budget Distribution
distributeBudget(totalBudget, currentDate, transactions, useAI): Promise<MonthBudget>

// Financial Month Calculations  
getFinancialMonthStart(date, financialDayStart): Date
getFinancialMonthEnd(date, financialDayStart): Date
getFinancialMonthLabel(date, financialDayStart): string

// State Management
useBudgetStore(): BudgetStore
setSettings(settings): void
```

### 🔐 Security Patterns
```typescript
// Authentication
requireAuth(): Promise<string>  // API route protection

// Input Validation
z.object({...})                // Zod schema validation

// User Isolation
// All queries include userId filter
```

### 📊 Common Data Structures
```typescript
interface Transaction {
  id: string;
  amount: number;        // kopecks (can be negative for expenses)
  description: string;
  mcc: number;          // Category code
  time: number;          // Unix timestamp
  currencyCode: number;
}

interface DayBudget {
  date: Date;
  limit: number;         // Daily budget limit
  spent: number;         // Actual spending
  remaining: number;     // limit - spent
  transactions: Transaction[];
  status: "under" | "warning" | "over";
  confidence?: number;    // AI confidence (0-1)
  reasoning?: string;    // AI explanation
}
```

## 🚨 Critical Notes for AI

### ⚠️ Must Remember
1. **Financial months ≠ Calendar months** - Always use financial month functions
2. **Historical budgets are immutable** - Never change past day limits
3. **AI has fallback mechanisms** - Always handle AI failures gracefully
4. **User data isolation** - Every query must include userId
5. **Ukrainian locale** - Use `uk` locale for date formatting
6. **Kopecks, not UAH** - All amounts are in kopecks (divide by 100 for UAH)

### ✅ Best Practices
1. **Check existing patterns** before creating new ones
2. **Use TypeScript strictly** - no `any` types
3. **Follow component patterns** - Tailwind classes, props structure
4. **Test edge cases** - month boundaries, leap years, empty data
5. **Consider offline functionality** - IndexedDB, error handling
6. **Maintain security** - input validation, user isolation
7. **Optimize for performance** - caching, memoization
8. **Document changes** - update relevant documentation

### 🔧 Development Commands
```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript checks

# Database
npx prisma generate      # Generate client
npx prisma db push       # Push schema changes
npx prisma studio       # Open database GUI

# Deployment
git push origin main     # Deploy to Railway
```

This documentation index should help AI assistants quickly navigate and understand the Burn Rate Calendar project structure and features.
