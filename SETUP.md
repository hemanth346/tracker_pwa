# P2P Lending Tracker - Setup Guide

## Quick Start

Your P2P Lending Tracker PWA is ready! Follow these steps to set it up:

### Step 1: Create Google Cloud Project (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `P2P Lending Tracker`
4. Click **"Create"**

### Step 2: Enable Required APIs (3 minutes)

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for and enable these APIs:
   - **Google Sheets API** - Click "Enable"
   - **Google Drive API** - Click "Enable"

### Step 3: Create OAuth 2.0 Credentials (7 minutes)

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: `P2P Lending Tracker`
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"**
   - Scopes: Skip this, click **"Save and Continue"**
   - Test users: Add your email, click **"Save and Continue"**
4. Back to Create OAuth client ID:
   - Application type: **Web application**
   - Name: `P2P Lending Tracker Web Client`
   - Authorized JavaScript origins:
     - Click **"+ ADD URI"**
     - Add: `http://localhost:8080` (for testing)
     - Add: `http://127.0.0.1:8080` (for testing)
     - Add your production URL if you have one
   - Authorized redirect URIs: Leave empty (not needed for this app)
   - Click **"CREATE"**
5. **IMPORTANT**: Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`)

### Step 4: Configure the App (2 minutes)

1. Open `config.js` in your project folder
2. Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual Client ID
3. Save the file

Example:
```javascript
GOOGLE_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
```

### Step 5: Run the App (1 minute)

1. Open Terminal in your project folder
2. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```
   Or if you have Node.js:
   ```bash
   npx serve -p 8080
   ```
3. Open your browser and go to: `http://localhost:8080`
4. Click **"Sign in with Google"**
5. Grant permissions when prompted
6. Start tracking your loans! 🎉

## Features

### 📊 Loan Tracking
- Record loan details with borrower information
- Track monthly interest rates
- Store multiple contacts per borrower
- Attach pro notes and documents

### 💵 Payment Tracking
- Record interest and principal payments
- Track payment methods (UPI, Bank Transfer, Cash)
- Attach payment receipts and screenshots
- Automatic calculation of:
  - Last payment date
  - Total interest paid
  - Paid till month

### ☁️ Google Sheets Integration
- All data stored in your Google Drive
- Direct access via Google Sheets
- Create custom reports and charts
- Export data easily

### 📱 Progressive Web App
- Install on any device (Android, iOS, Desktop)
- Works offline
- Fast and responsive
- Native app-like experience

## Installing on Mobile

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (⋮) → **"Add to Home Screen"**
3. Tap **"Install"**

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button (□↑)
3. Scroll and tap **"Add to Home Screen"**
4. Tap **"Add"**

## Accessing Your Data

### View in Google Sheets
- Click the **"📊 Open Sheet"** button in the app header
- Or go to Settings → **"Open Google Sheet"**
- Your spreadsheet will open in a new tab

### View Attachments
- Go to Settings → **"Open Attachments Folder"**
- All uploaded images are in your Google Drive

## Troubleshooting

### "Sign in failed" error
- Make sure you added `http://localhost:8080` to Authorized JavaScript origins
- Clear browser cache and try again
- Check that your Client ID is correct in `config.js`

### "Failed to create spreadsheet" error
- Make sure Google Sheets API is enabled
- Check your internet connection
- Sign out and sign in again

### Images not uploading
- Make sure Google Drive API is enabled
- Check file size (should be under 10MB per image)
- Verify you granted Drive permissions when signing in

## Data Schema

### Loans Sheet
- Date Given
- Name (Borrower)
- Amount Lent
- Monthly Interest Rate (%)
- Details/Purpose
- Via (Referrer/Surety)
- Has Pro Note (Yes/No)
- Status (Active/Closed/Defaulted)
- Date of Closure
- Contacts (JSON)
- Last Interest Payment Date (auto-calculated)
- Total Interest Paid (auto-calculated)
- Paid Till Month (auto-calculated)
- Attachments (Google Drive links)

### Interest Payments Sheet
- Payment Date
- Borrower Name
- Loan Reference
- Amount Received
- Payment Type (Interest/Principal/Both)
- Payment Method (UPI/Bank Transfer/Cash/Cheque)
- Received By
- Attachments (Google Drive links)
- Notes

## Security & Privacy

- Your data is stored in **your** Google Drive
- Only you can access your spreadsheet and attachments
- The app runs entirely in your browser
- No data is sent to any third-party servers
- Google OAuth ensures secure authentication

## Support

If you encounter any issues:
1. Check the browser console for error messages (F12 → Console)
2. Verify all setup steps were completed correctly
3. Make sure you're using a modern browser (Chrome, Firefox, Safari, Edge)

## Next Steps

1. ✅ Add your first loan
2. ✅ Record an interest payment
3. ✅ Install the app on your phone
4. ✅ Explore the Google Sheets integration
5. ✅ Customize the spreadsheet with your own formulas and charts

Enjoy tracking your P2P lending activities! 💰
