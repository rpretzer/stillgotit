# Project Review - Errors, Redundancies, and Dead Code

## 🔴 Critical Issues

### 1. Duplicate Events Files
**Issue:** Two events JSON files exist:
- `events.json` (root) - Contains array format
- `data/events.json` - Contains object with `events` array (CMS-managed)

**Impact:** Confusion about which file is the source of truth

**Recommendation:**
- Remove `events.json` from root (it's a legacy file)
- Keep only `data/events.json` (CMS-managed)
- The code already prefers `data/events.json` first, so this is safe

**Files to remove:**
- `events.json` (root level)

### 2. Unused/Dead Code: `merch-platform/` Directory
**Issue:** Entire `merch-platform/` directory exists but appears to be an old/unused implementation

**Evidence:**
- Current implementation uses static HTML + Cloudflare Workers
- `merch-platform/` contains Next.js/Prisma implementation
- No references to this directory in active code
- Documentation mentions it's unused

**Recommendation:**
- **Option A:** Remove entirely if confirmed unused
- **Option B:** Move to `archive/` or `deprecated/` if you want to keep for reference
- **Option C:** Add to `.gitignore` if you want to keep locally but not in repo

**Files/Directories:**
- `merch-platform/` (entire directory)

## ⚠️ Potential Issues

### 3. Unused Cancel Page
**Issue:** `merch/cancel/index.html` exists but no code references it

**Evidence:**
- No JavaScript redirects to `/merch/cancel/`
- No links point to it
- Stripe checkout doesn't redirect there

**Recommendation:**
- **Option A:** Remove if not needed
- **Option B:** Add redirect from Stripe checkout cancel if you want to use it
- **Option C:** Keep as static page for manual access

**File:**
- `merch/cancel/index.html`

### 4. Hardcoded Redirect in Tickets Page
**Issue:** `tickets/index.html` has hardcoded redirect URL

**Evidence:**
- Redirects to specific TicketsCandy event URL
- Not CMS-managed
- Will break if event changes

**Recommendation:**
- Make redirect URL CMS-managed via `content/site.json`
- Or use JavaScript to fetch from CMS and redirect dynamically

**File:**
- `tickets/index.html`

### 5. Console Logging in Production
**Issue:** Multiple `console.log`, `console.error`, `console.warn` statements

**Evidence:**
- 18+ console statements across JS files
- Some are useful (errors), some are debug logs

**Recommendation:**
- Keep `console.error` for actual errors (useful for debugging)
- Remove or conditionally log `console.log` statements
- Consider using a logging utility that can be disabled in production

**Files:**
- `assets/js/scripts.js` (1 console.log, multiple console.error/warn)
- `assets/js/merch.js` (1 console.debug)
- `assets/js/checkout.js` (3 console.error)
- `assets/js/recover-cart.js` (1 console.error)
- `assets/js/success.js` (1 console.error)

## 📝 Redundancies

### 6. Duplicate Merch Settings
**Issue:** Merch settings exist in both:
- `content/site.json` → `merch` object (global settings)
- `content/pages/merch.json` (page-specific settings)

**Evidence:**
- Both files contain similar settings (heroTitle, heroSubtitle, cartTitle, etc.)
- `scripts.js` loads from `site.json` but skips if `data-page` is set (line 616)
- `loadPageContent()` loads from `pages/merch.json` when `data-page="merch"` is set
- Merch page has `data-page="merch"`, so it uses `pages/merch.json`
- But `site.json` still has redundant `merch` object

**Recommendation:**
- ✅ Code already handles this correctly (skips `site.json` merch when `data-page` is set)
- Remove `merch` object from `site.json` to eliminate redundancy
- Keep only `checkout` and `success` objects in `site.json` (they're for separate pages)

### 7. Events Endpoint Fallbacks
**Issue:** `events.js` tries multiple endpoints but only one exists

**Evidence:**
- Code tries: `/data/events.json`, `/events.json`, `/api/events.json`
- Only `/data/events.json` exists and is used
- `/events.json` exists but is legacy format
- `/api/events.json` doesn't exist

**Recommendation:**
- Remove fallback endpoints after confirming `data/events.json` is working
- Or keep minimal fallback for resilience

**File:**
- `assets/js/events.js` (line 21)

## 🧹 Code Quality Issues

### 8. Inconsistent Error Handling
**Issue:** Some functions have error handling, others don't

**Recommendation:**
- Standardize error handling patterns
- Ensure all async functions have try/catch
- Consistent error logging format

### 9. Magic Strings/URLs
**Issue:** Hardcoded URLs and strings scattered throughout code

**Examples:**
- Stripe URLs
- API endpoints
- File paths

**Recommendation:**
- Create a constants/config file
- Centralize all URLs and paths
- Make them easily updatable

### 10. Missing Type Safety
**Issue:** JavaScript files lack JSDoc or TypeScript

**Recommendation:**
- Add JSDoc comments for functions
- Document parameters and return types
- Consider migrating to TypeScript for better type safety

## 📦 Dependencies

### 11. Minimal Dependencies
**Status:** ✅ Good
- Only `sharp` for image processing
- No unnecessary dependencies

**Recommendation:**
- Keep dependency list minimal
- Document why each dependency is needed

## 🗂️ File Organization

### 12. Documentation Files
**Status:** ✅ Good organization
- Clear documentation files
- Good separation of concerns

**Minor Recommendations:**
- Consider consolidating some docs if they overlap
- Add a main `CONTRIBUTING.md` or `DEVELOPMENT.md` guide

### 13. Workspace File
**Issue:** `still-got-it-collective.code-workspace` in repo

**Recommendation:**
- Add to `.gitignore` (editor-specific files shouldn't be in repo)
- Or document that it's intentionally shared

## ✅ What's Working Well

1. **Clean separation** between static site and merch backend
2. **Good CMS integration** with Decap CMS
3. **Proper cache-busting** implementation
4. **Image processing pipeline** is well-structured
5. **GitHub Actions workflows** are properly configured
6. **Media library** integration is clean

## 📋 Recommended Action Items (Priority Order)

### High Priority
1. ✅ Remove `events.json` from root (keep only `data/events.json`)
2. ✅ Remove or archive `merch-platform/` directory
3. ✅ Consolidate merch settings (remove from `site.json`, use only `pages/merch.json`)

### Medium Priority
4. ✅ Remove or implement `merch/cancel/index.html`
5. ✅ Make tickets redirect URL CMS-managed
6. ✅ Clean up console.log statements (keep errors, remove debug logs)
7. ✅ Simplify events.js endpoint fallbacks

### Low Priority
8. ✅ Add workspace file to `.gitignore`
9. ✅ Create constants/config file for URLs
10. ✅ Add JSDoc comments to functions
11. ✅ Standardize error handling patterns

## 🔍 Files to Review/Remove

**Definitely Remove:**
- `events.json` (root) - duplicate, legacy
- `merch-platform/` - unused implementation

**Consider Removing:**
- `merch/cancel/index.html` - if not used

**Consider Moving:**
- `still-got-it-collective.code-workspace` - to `.gitignore`

