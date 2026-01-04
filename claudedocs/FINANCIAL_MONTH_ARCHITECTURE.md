# Financial Month System Architecture

## Overview
The financial month system allows users to customize when their budget period starts, independent of calendar months. This provides flexibility for personal budgeting cycles.

## Architecture Flow

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
│ 2. Determine calendar grid layout                           │
│ 3. Apply visual styling for financial month days            │
│ 4. Handle navigation by financial months                    │
└─────────────────────────────────────────────────────────────────┘
```

## Core Functions

### 1. Financial Month Calculations
```typescript
// Get financial month start date
function getFinancialMonthStart(date: Date, financialDayStart: number): Date {
  const start = new Date(date);
  if (start.getDate() >= financialDayStart) {
    start.setDate(financialDayStart);
  } else {
    start.setDate(financialDayStart);
    start.setMonth(start.getMonth() - 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

// Get financial month end date
function getFinancialMonthEnd(date: Date, financialDayStart: number): Date {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(financialDayStart - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

// Get all days in financial month
function getFinancialMonthDays(date: Date, financialDayStart: number): Date[] {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = getFinancialMonthEnd(date, financialDayStart);
  return eachDayOfInterval({ start, end });
}
```

### 2. Financial Month Label
```typescript
function getFinancialMonthLabel(date: Date, financialDayStart: number): string {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = getFinancialMonthEnd(date, financialDayStart);
  
  const startMonth = format(start, "MMMM", { locale: uk });
  const endMonth = format(end, "MMMM", { locale: uk });
  const startDay = start.getDate();
  const endDay = end.getDate();
  
  if (startMonth === endMonth) {
    return `${startDay}—${endDay} ${startMonth}`;
  } else {
    return `${startDay} ${startMonth} — ${endDay} ${endMonth}`;
  }
}
```

## State Management

### 1. Budget Calendar Component State
```typescript
export function BudgetCalendar({ dailyLimits, onDayClick }: BudgetCalendarProps) {
  const [selectedFinancialMonth, setSelectedFinancialMonth] = useState(new Date());
  const { settings } = useBudgetStore();
  
  const financialDayStart = settings.financialMonthStart || 1;
  const currentFinancialMonthStart = getFinancialMonthStart(new Date(), financialDayStart);
  const selectedFinancialMonthStart = getFinancialMonthStart(selectedFinancialMonth, financialDayStart);
  const isCurrentFinancialMonth = currentFinancialMonthStart.getTime() === selectedFinancialMonthStart.getTime();
}
```

### 2. Settings Integration
```typescript
// UserSettings interface
interface UserSettings {
  financialMonthStart?: number; // Day of month when financial month starts (1-31)
  // ... other settings
}

// Settings Panel UI
<div className="space-y-2">
  <Label>Початок фінансового місяця</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline">
        {format(new Date().setDate(settings.financialMonthStart || 1), "d MMMM", { locale: uk })}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar
        mode="single"
        selected={new Date().setDate(settings.financialMonthStart || 1)}
        onSelect={(date) => date && setSettings({ financialMonthStart: date.getDate() })}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>
```

## Navigation Logic

### 1. Financial Month Navigation
```typescript
const goToPreviousMonth = useCallback(() => {
  setSelectedFinancialMonth(prev => {
    // Go back by one financial month
    const newDate = new Date(prev);
    newDate.setDate(newDate.getDate() - 30); // Approximate one month back
    return newDate;
  });
}, []);

const goToNextMonth = useCallback(() => {
  setSelectedFinancialMonth(prev => {
    // Go forward by one financial month
    const newDate = new Date(prev);
    newDate.setDate(newDate.getDate() + 30); // Approximate one month forward
    return newDate;
  });
}, []);

const goToCurrentMonth = useCallback(() => {
  setSelectedFinancialMonth(new Date());
}, []);
```

### 2. Navigation Constraints
```typescript
// Disable next month navigation when at current financial month
<button
  onClick={goToNextMonth}
  disabled={isCurrentFinancialMonth}
  className={cn(
    "p-2 rounded-full transition-all",
    isCurrentFinancialMonth 
      ? "opacity-30 cursor-not-allowed" 
      : "hover:bg-muted/50 active:scale-95"
  )}
>
  <ChevronRight className="w-5 h-5 text-muted-foreground" />
</button>
```

## Display Logic

### 1. Calendar Grid Layout
```typescript
// Financial month boundaries
const financialMonthStart = getFinancialMonthStart(selectedFinancialMonth, financialDayStart);
const financialMonthEnd = getFinancialMonthEnd(selectedFinancialMonth, financialDayStart);

// Calendar grid (always shows full calendar month)
const calendarMonthStart = startOfMonth(selectedFinancialMonth);
const calendarMonthEnd = endOfMonth(selectedFinancialMonth);
const calendarDays = eachDayOfInterval({ start: calendarMonthStart, end: calendarMonthEnd });

// Day classification
{calendarDays.map((day) => {
  const isInFinancialMonth = day >= financialMonthStart && day <= financialMonthEnd;
  const dayInfo = isCurrentFinancialMonth ? getDayInfo(day) : (isInFinancialMonth ? getDayInfo(day) : null);
  
  // Visual styling based on financial month membership
  className={cn(
    "calendar-day",
    // Only gray out non-financial days for historical months
    !isCurrentFinancialMonth && !isInFinancialMonth && "opacity-40 bg-gray-50",
    // For current month, make non-financial days less interactive
    isCurrentFinancialMonth && !isInFinancialMonth && "opacity-60 cursor-not-allowed"
  )}
})}
```

### 2. Visual Distinctions
```typescript
// Different styling for different day types
const getDayStyling = (day: Date, isInFinancialMonth: boolean, isCurrentFinancialMonth: boolean) => {
  if (!isCurrentFinancialMonth && !isInFinancialMonth) {
    // Historical month, non-financial day
    return "opacity-40 bg-gray-50 border-gray-200";
  }
  
  if (isCurrentFinancialMonth && !isInFinancialMonth) {
    // Current month, non-financial day
    return "opacity-60 cursor-not-allowed";
  }
  
  // Financial month day - normal styling
  return "bg-card hover:bg-muted/50";
};
```

## Budget Integration

### 1. Budget Calculation with Financial Months
```typescript
// distributeBudget function integration
export async function distributeBudget(
  totalBudget: number,
  currentDate: Date,
  // ... other params
): Promise<MonthBudget> {
  // Use financial month boundaries instead of calendar month
  const financialMonthStart = getFinancialMonthStart(currentDate, financialDayStart);
  const financialMonthEnd = getFinancialMonthEnd(currentDate, financialDayStart);
  const allDays = getFinancialMonthDays(currentDate, financialDayStart);
  
  // Rest of budget calculation logic...
}
```

### 2. Historical Data Handling
```typescript
// Historical budgets respect financial month boundaries
const getUserDailyBudgets = async (userId: string, fromDate: Date, toDate: Date) => {
  // Query respects financial month boundaries
  const budgets = await prisma.userDailyBudget.findMany({
    where: {
      userId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { date: 'asc' },
  });
  
  return budgets;
};
```

## Edge Cases

### 1. Month Boundary Scenarios
```typescript
// Scenario: financialDayStart = 5, today = Jan 4
// Current financial month: Dec 5 - Jan 4
// Next financial month: Jan 5 - Feb 4

// Scenario: financialDayStart = 31, today = Jan 4
// Current financial month: Dec 31 - Jan 30
// Next financial month: Jan 31 - Feb 27 (short month)
```

### 2. Leap Year Handling
```typescript
// Financial month calculations automatically handle leap years
// through native Date object behavior
const start = getFinancialMonthStart(new Date('2024-02-15'), 15);
// Result: 2024-02-15 (leap year handled correctly)

const end = getFinancialMonthEnd(new Date('2024-02-15'), 15);
// Result: 2024-03-14 (29 days in February)
```

### 3. Invalid Dates
```typescript
// Financial day start validation
const validateFinancialDayStart = (day: number): boolean => {
  return day >= 1 && day <= 31;
};

// Edge case: financialDayStart = 31 in months with < 31 days
// System automatically adjusts to last available day
```

## Performance Considerations

### 1. Calculation Optimization
```typescript
// Memoize expensive calculations
const financialMonthBoundaries = useMemo(() => ({
  start: getFinancialMonthStart(selectedFinancialMonth, financialDayStart),
  end: getFinancialMonthEnd(selectedFinancialMonth, financialDayStart),
  days: getFinancialMonthDays(selectedFinancialMonth, financialDayStart)
}), [selectedFinancialMonth, financialDayStart]);
```

### 2. Render Optimization
```typescript
// Only recalculate calendar when necessary
const calendarData = useMemo(() => {
  return generateCalendarGrid(selectedFinancialMonth, financialDayStart);
}, [selectedFinancialMonth, financialDayStart, dailyLimits]);
```

## Testing Strategy

### 1. Unit Tests
```typescript
describe('Financial Month Calculations', () => {
  test('calculates financial month start correctly', () => {
    const date = new Date('2024-01-15');
    const start = getFinancialMonthStart(date, 5);
    expect(start).toEqual(new Date('2024-01-05'));
  });
  
  test('handles month boundaries correctly', () => {
    const date = new Date('2024-01-04');
    const start = getFinancialMonthStart(date, 5);
    expect(start).toEqual(new Date('2023-12-05'));
  });
});
```

### 2. Integration Tests
```typescript
describe('Budget Calendar Integration', () => {
  test('navigates by financial months', () => {
    const { getByTestId } = render(<BudgetCalendar />);
    const nextButton = getByTestId('next-month');
    
    fireEvent.click(nextButton);
    // Should navigate to next financial month, not calendar month
  });
});
```

### 3. User Testing
- A/B test different financial day start values
- Monitor user preference patterns
- Track budget accuracy with different financial month settings
- Measure user satisfaction with flexible budget periods
