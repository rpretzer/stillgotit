# Mobile Upload Testing Guide

## Test Configuration

### Setup Verification ✅
- [x] Viewport meta tag present: `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- [x] Decap CMS script loaded: `https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js`
- [x] Media folder configured: `assets/images/uploads`
- [x] Mobile responsive CSS added
- [x] Image upload widgets configured in collections

## Manual Testing Checklist

### 1. Basic Mobile Access
- [ ] Open admin interface on mobile device: `https://www.stillgotitcollective.com/admin/`
- [ ] Verify login/authentication works
- [ ] Check that sidebar is accessible (may be hidden behind hamburger menu)
- [ ] Verify responsive CSS is applied (full-width layout)

### 2. Media Library Access
- [ ] Navigate to "Media Library" → "All Images" collection
- [ ] Verify all 120 images are visible with previews
- [ ] Check that images load correctly
- [ ] Verify URLs are clickable/copyable

### 3. Photo Roll Upload Test
**Test Location:** Latest Updates collection (has image upload field)

- [ ] Go to "Latest Updates" → Edit any update or create new
- [ ] Find "Image upload" field
- [ ] Tap the upload button/browse button
- [ ] **Expected:** Mobile file picker opens
- [ ] **Test Sources:**
  - [ ] Camera Roll / Photo Library (iOS)
  - [ ] Gallery (Android)
  - [ ] Files app
  - [ ] Google Photos (if accessible through file picker)

### 4. Image Upload Widget Behavior
**Test Collections with Image Uploads:**
- Latest Updates (imageUpload field)
- Gallery (srcUpload, thumbUpload fields)
- Instagram Previews (image field)

For each:
- [ ] Tap upload button
- [ ] Select image from photo roll
- [ ] Verify image preview appears
- [ ] Check upload progress (if visible)
- [ ] Verify image saves to correct path: `assets/images/uploads/`
- [ ] Check that file appears in Media Library after upload

### 5. File Size & Format Testing
- [ ] Upload small image (< 1MB)
- [ ] Upload large image (> 5MB) - note any timeouts
- [ ] Test formats: JPG, PNG, WebP
- [ ] Verify upload completes successfully

### 6. Mobile UI Elements
- [ ] Buttons are tappable (44px minimum height)
- [ ] Form inputs don't zoom on focus (16px font size)
- [ ] Modals display full-screen on mobile
- [ ] Sidebar/navigation is accessible
- [ ] Text is readable without zooming

### 7. Upload to GitHub
- [ ] After uploading image, save the entry
- [ ] Verify GitHub commit is created
- [ ] Check file appears in repo: `assets/images/uploads/`
- [ ] Verify file is accessible on live site

## Known Limitations

1. **GitHub Backend:** 
   - Files upload directly to GitHub (may be slow for large files)
   - No automatic image optimization
   - No progress indicator during upload

2. **Browser File Picker:**
   - Varies by device/browser
   - Google Photos may not always be accessible (depends on setup)
   - Some devices require granting permissions

3. **Mobile UI:**
   - Not fully optimized by Decap CMS
   - Custom CSS helps but some limitations remain
   - Complex forms may be challenging on small screens

## Troubleshooting

### Upload Button Not Working
- Check browser console for errors
- Verify authentication is active
- Try desktop view to compare behavior

### File Picker Not Opening
- Check browser permissions for file access
- Try different browser (Chrome, Safari, Firefox)
- Verify HTTPS is being used (required for file API)

### Upload Fails
- Check file size limits (GitHub has limits)
- Verify network connection
- Check GitHub authentication/permissions

### Image Not Appearing After Upload
- Wait for GitHub commit to complete
- Refresh Media Library collection
- Check browser console for errors
- Verify file was actually committed to repo

## Expected Behavior Summary

**Working:**
- ✅ File picker opens on mobile
- ✅ Can select from camera roll/gallery
- ✅ Upload button triggers file selection
- ✅ Files upload to GitHub and appear in repo
- ✅ Mobile responsive layout applied

**May Vary:**
- ⚠️ Google Photos access (depends on device/browser)
- ⚠️ Upload speed (depends on file size and connection)
- ⚠️ UI polish (Decap CMS limitations)

**Enhanced Options (if needed):**
- Uploadcare integration for better mobile UX
- Cloudinary integration for image optimization

