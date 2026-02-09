# Release v2.0.0 - Real-time Multi-device Sync

**Release Date:** February 9, 2026
**Type:** Major Feature Release

## 🎯 Overview

This release transforms Burn Rate Calendar from a single-device app to a fully synchronized multi-device experience with real-time updates.

## ✨ New Features

### Multi-Device Synchronization
- **Auto-refresh every 10 seconds** - Your data stays current across all devices
- **Database-backed storage** - All settings, budget, and categories now stored on server
- **SWR integration** - Smart caching and automatic revalidation

### Optimistic UI Updates
- **Instant feedback** - UI updates immediately before server confirms
- **Automatic rollback** - If server fails, UI reverts gracefully
- **Toast notifications** - User-friendly error messages

### Loading States
- **Skeleton screens** - Smooth loading experience
- **Background sync indicator** - Know when data is syncing

### Developer Features
- **Feature flags** - Safe rollout control via environment variables
- **Race condition guards** - Prevents duplicate sync operations
- **Comprehensive error handling** - Better debugging and user experience

## 🐛 Bug Fixes

### Critical
- Fixed budget calculation using card balance instead of remaining budget
- Fixed race conditions in concurrent sync operations
- Fixed totalSpent/totalRemaining calculations in optimistic updates
- Removed incorrect React hooks usage in optimistic functions

### Important
- Added proper TypeScript types throughout
- Improved error handling with user-facing notifications
- Fixed incremental sync fallback logic

## 🔧 Technical Changes

### Database Schema
- Added `UserCategory` table for custom categories
- Added `TransactionCategory` table for transaction categorization
- Updated `user_settings` table structure

### API Endpoints
- `POST /api/db/user-settings` - Settings CRUD
- `GET /api/db/budget` - Budget calculation with caching
- `POST /api/db/categories` - Categories management

### Dependencies
- Added `swr@^2.2.5` for data fetching
- Added `sonner@^1.4.0` for toast notifications

## 📊 Performance

- **Initial load:** ~4-5 API calls
- **Background refresh:** 1 call every 10 seconds (budget only)
- **Deduplication:** SWR prevents redundant requests
- **Bundle size:** +~15KB gzipped (SWR + Sonner)

## 🚀 Migration Guide

### For Users
No action required! The app will automatically migrate your data on first load after update.

**Note:** You may need to hard refresh (Ctrl+Shift+R) once after deployment to clear old cache.

### For Developers
1. Run database migrations: `npx prisma migrate deploy`
2. Set environment variables (optional):
   ```bash
   NEXT_PUBLIC_FEATURE_SWR_BUDGET=true
   NEXT_PUBLIC_FEATURE_SWR_SETTINGS=true
   NEXT_PUBLIC_FEATURE_SWR_CATEGORIES=true
   NEXT_PUBLIC_FEATURE_OPTIMISTIC=true
   NEXT_PUBLIC_FEATURE_REALTIME=true
   ```
3. Deploy to staging first for testing

## 🧪 Testing Recommendations

- [ ] Test settings sync across 2+ devices
- [ ] Test budget recalculation with new transactions
- [ ] Test category management
- [ ] Test error handling (network errors, server errors)
- [ ] Test loading states
- [ ] Monitor API call frequency

## 📝 Known Issues

- Feature flags are enabled by default (set to `false` to disable)
- Multi-device sync has ~10 second delay (by design)

## 🔗 Commits

**Real-time Migration:**
- 2da6cdb: Step 1 - API endpoints
- 2fe1991: Step 2 - SWR integration
- 63b518e: Step 3 - Optimistic updates
- 9fe67a5: Step 4 - Documentation
- 7fade0f: Priority 1 critical fixes
- 7a05b35: Priority 2 important features

**Previous Fixes:**
- e2a053b: Budget calculation fix
- e710c50: Incremental sync
- bbadbe6: CI/CD fixes
- cfc561f: Race condition guards
- ccfdaf3: Type fixes

## 👥 Contributors

- OpenClaw Bot (@openclaw)
- Yuriy (@yivivz)

---

**Full Changelog:** https://github.com/yivjooble/burn-rate-calendar/compare/v1.0.0...v2.0.0
