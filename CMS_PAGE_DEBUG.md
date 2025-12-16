# CMS Page Content Loading - Debug Guide

## Issue
Changes made in Decap CMS to the legal page are not appearing on the website after several hours.

## Current Status

### ✅ What's Working
- JSON file is committed to repository (`content/pages/legal.json`)
- CMS config is properly set up for legal page
- JavaScript function `loadPageContent()` exists and should load content
- Code handles both string and object formats for body paragraphs

### 🔍 Potential Issues

1. **Browser/CDN Caching**
   - Browsers may cache the JSON file
   - GitHub Pages/CDN may cache static files
   - **Fix Applied**: Added cache-busting query parameters (`?t=timestamp`)

2. **CMS Config vs JSON Format Mismatch**
   - CMS config expects: `body: [{ paragraph: "text" }]`
   - Actual JSON has: `body: ["text"]`
   - **Status**: JavaScript handles both formats, so this is OK

3. **Fetch Errors**
   - Network errors might be failing silently
   - **Fix Applied**: Enhanced error logging

## Changes Made

### 1. Enhanced Cache-Busting
Added timestamp query parameters to all JSON fetches:
```javascript
const fetchUrl = url.toString() + `?t=${Date.now()}`;
```

### 2. Better Error Logging
Added console.error for failed fetches with URL information.

### 3. Cache-Control Headers
Added explicit cache-control headers to fetch requests.

## Testing Steps

1. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear cache in browser settings

2. **Check Browser Console**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab to see if JSON file is being fetched

3. **Verify JSON File**
   ```bash
   cat content/pages/legal.json | jq '.sections[].title'
   ```
   Should show sections in the order you expect.

4. **Test Direct JSON Access**
   Visit: `https://www.stillgotitcollective.com/content/pages/legal.json?t=1234567890`
   - Should show current JSON content
   - Check if content matches what you see in CMS

5. **Check Network Tab**
   - Open DevTools → Network tab
   - Reload page
   - Find `legal.json` request
   - Check:
     - Status code (should be 200)
     - Response content (should match CMS)
     - Cache headers

## Expected Behavior

When the page loads:
1. JavaScript fetches `content/pages/legal.json?t=timestamp`
2. Clears existing HTML in `#page-content-grid`
3. Rebuilds content from JSON sections
4. Sections should appear in the order defined in JSON

## Current JSON Order
1. Photo credits
2. Terms & conditions
3. Privacy
4. Website ownership & intellectual property

## If Still Not Working

1. **Check if function is being called**
   - Add `console.log('loadPageContent called')` at start of function
   - Check browser console

2. **Check if grid element exists**
   - Verify `#page-content-grid` exists in HTML
   - Check if it's being cleared: `grid.innerHTML = ''`

3. **Verify JSON structure**
   - Ensure JSON is valid
   - Check that `sections` is an array
   - Verify each section has `title` and `body`

4. **Check for JavaScript errors**
   - Any errors in console will prevent execution
   - Fix errors and retry

5. **Force hard refresh**
   - Clear all site data
   - Or use incognito/private window

## Next Steps

1. Deploy the updated JavaScript with cache-busting
2. Test in browser with hard refresh
3. Check browser console for any errors
4. Verify JSON is being fetched with correct content

