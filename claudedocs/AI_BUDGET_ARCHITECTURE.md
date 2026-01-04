# AI Budget Distribution Architecture

## Overview
The AI budget distribution system provides intelligent daily budget limits based on historical spending patterns. It's a rule-based AI system that analyzes user behavior and creates personalized budget recommendations.

## Architecture Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Settings │    │  Historical Data │    │  AI Engine     │
│ - useAIBudget │───▶│ - Last 90 txns  │───▶│ - Pattern       │
│ - financialDay │    │ - Categories     │    │   Analysis      │
└─────────────────┘    └──────────────────┘    │ - Weight        │
                                              │   Calculation  │
                                              └────────┬────────┘
                                                       │
┌───────────────────────────────────────────────────────────────┴────────┐
│                    distributeBudget() Function                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Load historical budgets (past days)                        │
│ 2. Call AI endpoint if useAI=true                             │
│ 3. Fallback to traditional distribution if AI fails            │
│ 4. Generate DayBudget[] with confidence/reasoning             │
└─────────────────────────────────────────────────────────────────────────┘
```

## AI Endpoint: `/api/ai/budget-distribution`

### Input Schema
```typescript
interface BudgetRequest {
  totalBudget: number;           // Current month budget
  currentBalance: number;        // Available balance for distribution
  transactions: TransactionData[]; // Last 90 transactions for analysis
  startDate: string;            // Financial month start (ISO)
  endDate: string;              // Financial month end (ISO)
  financialMonthStart?: number;  // Day of month (1-31)
}
```

### Output Schema
```typescript
interface DayBudget {
  date: string;        // YYYY-MM-DD format
  limit: number;       // Daily budget limit in kopecks
  confidence: number;   // AI confidence (0-1)
  reasoning?: string;   // Explanation for the limit
}
```

## AI Analysis Algorithm

### 1. Pattern Recognition
```typescript
// Day-of-week spending patterns
const dayOfWeekPatterns: Record<number, number> = {};
expenses.forEach(tx => {
  const dayOfWeek = new Date(tx.time * 1000).getDay();
  dayOfWeekPatterns[dayOfWeek] = (dayOfWeekPatterns[dayOfWeek] || 0) + Math.abs(tx.amount);
});

// Category spending patterns (MCC codes)
const categoryPatterns: Record<number, number> = {};
expenses.forEach(tx => {
  categoryPatterns[tx.mcc] = (categoryPatterns[tx.mcc] || 0) + Math.abs(tx.amount);
});
```

### 2. Weight Calculation
```typescript
// Calculate weight for each day based on historical patterns
const dayOfWeekAverage = dayOfWeekAverages[dayOfWeek] || 0;
const averageSpending = averageDailySpending || baseDailyBudget;

let weight = 1.0;
if (dayOfWeekAverage > 0 && averageSpending > 0) {
  weight = (dayOfWeekAverage / averageSpending) * seasonalFactor;
}

// Apply smoothing to avoid extreme variations
weight = Math.max(0.3, Math.min(3.0, weight));
```

### 3. Confidence Scoring
```typescript
// Data confidence based on transaction count
const dataConfidence = Math.min(1.0, totalTransactions / 100);

// Pattern consistency based on spending variance
const patternConsistency = 1.0 - Math.abs(daySpending - averageSpending) / averageSpending;

// Overall confidence
const confidence = (dataConfidence + patternConsistency) / 2;
```

## Integration Points

### 1. Budget Calendar Component
```typescript
// UI Toggle in Settings
<Checkbox 
  checked={settings.useAIBudget ?? true}
  onChange={(e) => setSettings({ useAIBudget: e.target.checked })}
/>

// AI Budget Display
{dayBudget.confidence && (
  <div className="text-xs text-muted-foreground">
    AI: {(dayBudget.confidence * 100).toFixed(0)}% confidence
  </div>
)}
{dayBudget.reasoning && (
  <Tooltip content={dayBudget.reasoning}>
    <Info className="w-4 h-4" />
  </Tooltip>
)}
```

### 2. Budget Store Integration
```typescript
// Settings persistence
interface UserSettings {
  useAIBudget?: boolean; // Enable AI distribution
  // ... other settings
}

// DayBudget extension for AI data
interface DayBudget {
  // ... existing fields
  confidence?: number; // AI confidence level (0-1)
  reasoning?: string; // AI explanation for limit
}
```

## Fallback Strategy

### 1. AI Failure Handling
```typescript
try {
  const aiResponse = await fetch("/api/ai/budget-distribution", { ... });
  if (aiResponse.ok) {
    return aiData.dailyBudgets;
  }
} catch (error) {
  console.warn("AI budget distribution failed:", error);
}

// Fallback to traditional equal distribution
const availableBudget = Math.max(0, currentBalance);
const limit = availableBudget / futureDays.length;
```

### 2. Insufficient Data Handling
```typescript
// If < 10 transactions, use simple distribution
if (transactions.length < 10) {
  return generateEqualDistribution(availableBudget, days);
}

// If no historical patterns, use day-of-week averages
if (Object.keys(dayOfWeekPatterns).length === 0) {
  return generateWeekdayWeightedDistribution(availableBudget, days);
}
```

## Performance Considerations

### 1. Caching Strategy
- AI results cached by (userId + startDate + endDate)
- Cache TTL: 1 hour for same parameters
- Invalidation: New transactions or budget changes

### 2. Data Limits
- Maximum transactions: 90 (last ~3 months)
- Maximum analysis time: 2 seconds
- Memory usage: < 10MB for pattern analysis

### 3. Rate Limiting
- AI endpoint: 10 requests/minute per user
- Fallback protection: Automatic switch to traditional distribution
- Error tracking: Monitor AI success/failure rates

## Monitoring & Debugging

### 1. Logging Strategy
```typescript
// Request logging
console.log("[AI-BUDGET] Request:", {
  userId,
  totalBudget,
  transactionCount: transactions.length,
  startDate,
  endDate
});

// Pattern analysis logging
console.log("[AI-BUDGET] Patterns:", {
  dayOfWeekAverages,
  topCategories: categories.slice(0, 3),
  seasonalFactor
});

// Result logging
console.log("[AI-BUDGET] Generated:", {
  dailyBudgetsCount: dailyBudgets.length,
  averageConfidence: avgConfidence,
  totalDistributed: totalLimit
});
```

### 2. Performance Metrics
- AI success rate: Target > 95%
- Average response time: Target < 500ms
- Memory usage: Target < 5MB per request
- User satisfaction: Monitor AI toggle usage

## Future Enhancements

### 1. Machine Learning Integration
- Replace rule-based system with TensorFlow.js model
- Train on user's historical data
- Improve accuracy over time

### 2. External AI Services
- OpenAI API for complex pattern recognition
- Transaction description analysis
- Category prediction improvements

### 3. Advanced Features
- Seasonal trend detection
- Anomaly detection in spending
- Personalized recommendations
- Budget optimization suggestions

## Security & Privacy

### 1. Data Protection
- All analysis server-side (no external AI services)
- User data isolation by userId
- No PII in AI prompts

### 2. Rate Limiting
- Per-user rate limits on AI endpoint
- Automatic fallback protection
- DDoS protection

## Testing Strategy

### 1. Unit Tests
- Pattern analysis algorithms
- Weight calculation accuracy
- Confidence scoring logic
- Fallback mechanisms

### 2. Integration Tests
- End-to-end AI budget flow
- Settings toggle functionality
- Error handling scenarios
- Performance benchmarks

### 3. User Testing
- A/B testing: AI vs traditional
- User satisfaction surveys
- Budget accuracy measurements
- Feature adoption rates
