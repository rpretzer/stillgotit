# Instagram API Setup Guide

## Overview

To automatically fetch Instagram posts, you'll need to set up Instagram Graph API integration. This requires several steps and infrastructure changes.

## Prerequisites

### 1. Instagram Account Requirements
- ✅ Instagram account must be a **Business** or **Creator** account (not personal)
- ✅ Account must be linked to a **Facebook Page**
- ✅ You need admin access to both Instagram and Facebook accounts

### 2. Facebook Developer Setup
- Facebook Developer account (free)
- Facebook App created
- Instagram Graph API product added to app

## Step-by-Step Setup

### Step 1: Convert Instagram Account to Business/Creator
1. Open Instagram app → Settings → Account
2. Select "Switch to Professional Account"
3. Choose "Business" or "Creator"
4. Complete the setup process

### Step 2: Link Instagram to Facebook Page
1. In Instagram app → Settings → Account → Linked Accounts
2. Link to a Facebook Page (create one if needed)
3. Ensure you're an admin of the Facebook Page

### Step 3: Create Facebook App
1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Choose app type: **Business**
4. Fill in app details:
   - App Name: "Still Got It Collective Website"
   - Contact Email: your email
5. Click "Create App"

### Step 4: Add Instagram Graph API
1. In your app dashboard, go to "Add Products"
2. Find "Instagram Graph API" → Click "Set Up"
3. This adds the API to your app

### Step 5: Configure App Settings
1. Go to **Settings** → **Basic**
   - Note your **App ID** and **App Secret**
   - Add **App Domains**: `stillgotitcollective.com`
   - Add **Privacy Policy URL** (required for production)
   - Add **Terms of Service URL** (required for production)

2. Go to **Settings** → **Advanced**
   - Enable **OAuth Login**
   - Add **Valid OAuth Redirect URIs**:
     - `https://stillgotitcollective.com/admin/instagram-callback`
     - `https://your-worker-url.workers.dev/instagram/callback` (if using Cloudflare Worker)

### Step 6: Get Instagram Business Account ID
1. Use [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from dropdown
3. Add token with permissions: `instagram_basic`, `pages_read_engagement`
4. Make request: `GET /me/accounts`
5. Find your Facebook Page ID
6. Make request: `GET /{page-id}?fields=instagram_business_account`
7. Note the `instagram_business_account.id` - this is your Instagram Business Account ID

### Step 7: Generate Access Token
1. In Graph API Explorer, select your app
2. Add permissions: `instagram_basic`, `pages_read_engagement`, `pages_show_list`
3. Generate User Token (short-lived, expires in ~1 hour)
4. Exchange for Long-Lived Token (expires in ~60 days):
   ```
   GET /oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```

### Step 8: Get User Media
Once you have the long-lived token, you can fetch posts:
```
GET /{instagram-business-account-id}/media?
  fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&
  limit=12&
  access_token={long-lived-token}
```

## Implementation Options

### Option 1: Cloudflare Worker (Recommended)
Since you already have a Cloudflare Worker for merch backend, you can add Instagram API endpoints there.

**Pros:**
- ✅ Already have infrastructure
- ✅ Serverless, no server management
- ✅ Can store tokens in D1 or KV
- ✅ Can set up cron for automatic refresh

**Cons:**
- ⚠️ Need to implement token refresh logic
- ⚠️ Need to handle OAuth flow

**Implementation Steps:**
1. Add Instagram API endpoints to `workers/merch-backend/src/index.ts`
2. Store access tokens in D1 or Cloudflare KV
3. Create cron job to refresh tokens before expiration
4. Create endpoint: `GET /api/instagram/posts` that fetches from Instagram API
5. Update frontend to fetch from this endpoint instead of CMS

### Option 2: Third-Party Service
Use services like:
- **SnapWidget** (paid, ~$10/month)
- **EmbedSocial** (paid, ~$15/month)
- **Elfsight Instagram Feed** (free tier available)

**Pros:**
- ✅ No API setup needed
- ✅ Handles token management
- ✅ Easy to implement

**Cons:**
- ⚠️ Monthly cost
- ⚠️ Less control
- ⚠️ May have branding

### Option 3: Manual CMS (Current)
Keep using the CMS to manually add Instagram post images.

**Pros:**
- ✅ No API setup
- ✅ No ongoing costs
- ✅ Full control

**Cons:**
- ⚠️ Manual updates required
- ⚠️ Not automatic

## Token Management Challenges

### Long-Lived Token Expiration
- Long-lived tokens expire in ~60 days
- Need to refresh before expiration
- Requires automated process (cron job)

### Token Refresh Process
1. Before token expires, exchange for new long-lived token
2. Store new token securely
3. Update API calls to use new token

## Required Permissions/Scopes

For fetching posts, you need:
- `instagram_basic` - Basic profile info
- `pages_read_engagement` - Read page engagement
- `pages_show_list` - List connected pages

## Security Considerations

1. **Never expose App Secret or Access Tokens in frontend code**
2. **Store tokens server-side only** (Cloudflare Worker, KV, or D1)
3. **Use environment variables** for sensitive data
4. **Implement token refresh** before expiration
5. **Add rate limiting** to prevent abuse

## Testing

Use Graph API Explorer to test:
1. Test token generation
2. Test fetching media
3. Verify response format
4. Check rate limits

## Next Steps

If you want to proceed with Cloudflare Worker implementation:

1. **Set up Instagram Business account** (Steps 1-2)
2. **Create Facebook App** (Steps 3-5)
3. **Get initial access token** (Steps 6-7)
4. **I can help implement** the Worker endpoints and frontend integration

Would you like me to:
- Create the Cloudflare Worker endpoints for Instagram API?
- Set up the token refresh cron job?
- Update the frontend to fetch from the API?

## Alternative: Simplified Approach

If full API setup is too complex, consider:
1. **RSS Feed** - Some third-party services provide Instagram RSS feeds
2. **Web Scraping** - Not recommended (violates ToS, unreliable)
3. **Manual Updates** - Current CMS approach (simplest, most reliable)

## Resources

- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Facebook App Dashboard](https://developers.facebook.com/apps/)

