# BRC Migration: LocalStorage → Database + Real-time Updates

## Testing Checklist

### 4.1 Functional Testing

- [ ] **Settings persist to DB**
  - [ ] User settings are saved to `user_settings` table
  - [ ] Settings are retrieved correctly on page load
  - [ ] Sensitive keys (monoToken) are NOT returned to client
  - [ ] Bulk update works correctly

- [ ] **Budget calculates correctly**
  - [ ] Budget API returns correct totalBudget
  - [ ] Daily limits are calculated properly
  - [ ] Transaction filtering works (by accountId, date range)
  - [ ] Historical month view works

- [ ] **Categories CRUD works**
  - [ ] Categories are saved to `user_categories` table
  - [ ] Categories are retrieved correctly
  - [ ] Bulk replace works
  - [ ] Single add works
  - [ ] Delete works

- [ ] **Multi-device sync**
  - [ ] Settings sync across devices
  - [ ] Categories sync across devices
  - [ ] Budget data is consistent

- [ ] **Auto-refresh (10-30 seconds)**
  - [ ] Budget refreshes every 10 seconds
  - [ ] Settings refresh every 30 seconds
  - [ ] Categories refresh every 60 seconds
  - [ ] No excessive API calls (deduplication works)

- [ ] **Optimistic updates**
  - [ ] Settings update immediately in UI
  - [ ] Categories update immediately in UI
  - [ ] Rollback works on error
  - [ ] No UI flicker

- [ ] **No race conditions**
  - [ ] Multiple rapid updates don't conflict
  - [ ] Server responses override stale optimistic updates

- [ ] **Error handling**
  - [ ] Network errors show user-friendly message
  - [ ] 401 Unauthorized handled correctly
  - [ ] 500 errors logged and handled

### 4.2 Performance Testing

- [ ] **API call count**
  - [ ] Initial load: ~4-5 API calls (settings, budget, categories, etc.)
  - [ ] Background refresh: 1 API call every 10 seconds (budget only)
  - [ ] No duplicate requests (SWR deduping works)

- [ ] **Caching effectiveness**
  - [ ] SWR cache hit on rapid re-renders
  - [ ] LocalStorage fallback for offline mode

- [ ] **No unnecessary re-renders**
  - [ ] Components only re-render when data changes
  - [ ] Optimistic updates don't cause cascade re-renders

### 4.3 Code Review Checklist

#### TypeScript Types ✅
- [ ] All interfaces properly defined
- [ ] No `any` types without justification
- [ ] Generic types used correctly
- [ ] Union types for status fields

#### Error Handling ✅
- [ ] Try-catch blocks where needed
- [ ] Error boundaries for React components
- [ ] User-friendly error messages
- [ ] Error logging for debugging

#### Loading States ✅
- [ ] Skeleton screens during loading
- [ ] Spinners for background operations
- [ ] No "flash of unstyled content"

#### Migration Safety ✅
- [ ] LocalStorage data preserved during migration
- [ ] Backward compatibility with existing data
- [ ] Rollback plan if migration fails
- [ ] Data validation before migration

---

## Deployment Recommendations

### Pre-deployment Checklist
- [ ] Run database migrations (`npx prisma migrate deploy`)
- [ ] Verify all API endpoints work in staging
- [ ] Test optimistic updates on mobile
- [ ] Check SWR refresh intervals (adjust if needed)
- [ ] Monitor API rate limits

### Rollback Plan
1. Revert to previous commit
2. Restore LocalStorage-only mode (already in code)
3. No database migration needed for rollback

### Monitoring
- [ ] Set up alerts for API error rates
- [ ] Monitor SWR cache hit rates
- [ ] Track budget calculation performance
- [ ] Monitor database query performance

### Feature Flags
The following features can be toggled:
- `USE_SWR_BUDGET` - Enable SWR for budget data
- `USE_SWR_SETTINGS` - Enable SWR for settings
- `USE_SWR_CATEGORIES` - Enable SWR for categories
- `OPTIMISTIC_UPDATES` - Enable optimistic UI updates

---

## Migration Progress

| Feature | Status | Notes |
|---------|--------|-------|
| API Endpoints | ✅ Complete | user-settings, budget, categories |
| DB Schema | ✅ Complete | Added UserCategory, TransactionCategory |
| SWR Hooks | ✅ Complete | useSettings, useBudget, useCategories |
| Optimistic Updates | ✅ Complete | All CRUD operations |
| Integration | ⏳ Pending | Components need refactoring |
| Testing | ⏳ Pending | Manual + automated testing |

---

## Files Modified

### New Files
- `src/app/api/db/user-settings/route.ts`
- `src/app/api/db/budget/route.ts`
- `src/app/api/db/categories/route.ts`
- `src/lib/hooks/useBudget.ts`
- `src/lib/hooks/useOptimisticUpdates.ts`
- `src/app/page.swr.tsx`

### Modified Files
- `prisma/schema.prisma` - Added UserCategory, TransactionCategory
- `src/lib/db.ts` - Added category functions
- `src/types/index.ts` - Added CustomCategory
- `src/store/budget-store.ts` - SWR integration methods

---

## Next Steps

1. **Component Refactoring** (Phase 2)
   - Replace Zustand store calls with SWR hooks in components
   - Update SettingsPanel to use useOptimisticSettings
   - Update CategoriesPage to use useOptimisticCategories
   - Update BudgetCalendar to use useBudget

2. **Testing**
   - Write unit tests for SWR hooks
   - Write integration tests for API endpoints
   - E2E tests for user flows

3. **Monitoring**
   - Deploy with feature flags
   - Monitor performance metrics
   - Gather user feedback
