# Loan Tracker - Technical Architecture

## 🏗️ System Overview

**Architecture**: Client-side PWA with Google Cloud Backend  
**Framework**: Vanilla JavaScript (no framework dependencies)  
**Storage**: Google Sheets (via Sheets API v4)  
**File Storage**: Google Drive (via Drive API v3)  
**Authentication**: Google Identity Services (OAuth 2.0)

---

## 📐 Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   index.html │  │  manifest    │  │  sw.js       │  │
│  │   (UI)       │  │  (PWA)       │  │  (Offline)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │           JavaScript Modules                      │  │
│  ├──────────────┬──────────────┬──────────────────┐  │
│  │  app.js      │  auth.js     │  sheets.js       │  │
│  │  (Main)      │  (OAuth)     │  (CRUD)          │  │
│  ├──────────────┼──────────────┼──────────────────┤  │
│  │  ui.js       │  drive.js    │  config.js       │  │
│  │  (UI Logic)  │  (Files)     │  (Settings)      │  │
│  └──────────────┴──────────────┴──────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Google Cloud Services                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Identity    │  │  Sheets API  │  │  Drive API   │  │
│  │  Services    │  │  (Data)      │  │  (Files)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    User's Google Drive                   │
├─────────────────────────────────────────────────────────┤
│  • Loan Data (Spreadsheet)                               │
│  • Loan Attachments (Folder with images)                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. Authentication Flow
```
User clicks "Sign In"
  ↓
app.js → auth.signIn()
  ↓
Google Identity Services (popup)
  ↓
User grants permissions
  ↓
auth.onAuthSuccess() → Fetch user info
  ↓
Store token & user in localStorage
  ↓
Initialize Sheets & Drive APIs
  ↓
Load main app view
```

### 2. Add Loan Flow
```
User fills loan form
  ↓
app.submitLoanForm()
  ↓
Validate form data
  ↓
Upload images (if any) → drive.uploadMultipleImages()
  ↓
Get Drive links
  ↓
Generate Loan ID (LOAN-YYYYMMDD-XXX)
  ↓
sheets.addLoan() → Append row to Sheets
  ↓
Refresh UI → ui.loadLoans()
```

### 3. Add Payment Flow
```
User fills payment form
  ↓
app.submitPaymentForm()
  ↓
Upload images (if any)
  ↓
sheets.addPayment() → Append to Payments sheet
  ↓
sheets.updateLoanCalculatedFields(loanId)
  ↓
Calculate: last payment date, total interest, paid till month
  ↓
Update Loans sheet with calculated values
  ↓
Refresh UI
```

---

## 🗄️ Data Models

### Loan Object
```javascript
{
  rowIndex: 2,              // Sheet row number
  loanId: "LOAN-20251207-001",
  dateGiven: "2024-12-07",
  name: "John Doe",
  amount: 50000,
  interestRate: 2.5,
  details: "Business loan",
  via: "Friend referral",
  hasProNote: true,
  status: "Active",
  dateOfClosure: "",
  contacts: [
    { name: "Jane Doe", relation: "Spouse", phone: "9876543210" }
  ],
  lastPaymentDate: "2024-12-07",  // Calculated
  totalInterestPaid: 2500,         // Calculated
  paidTillMonth: "Dec 2024",       // Calculated
  attachments: "[{\"id\":\"...\",\"link\":\"...\"}]"
}
```

### Payment Object
```javascript
{
  rowIndex: 2,
  paymentDate: "2024-12-07",
  loanId: "LOAN-20251207-001",
  borrowerName: "John Doe",
  amount: 2500,
  paymentType: "Interest",
  paymentMethod: "UPI",
  receivedBy: "Self",
  attachments: "[...]",
  notes: "Monthly interest"
}
```

---

## 🔌 API Integration Patterns

### Google Sheets API

**Authentication**:
```javascript
gapi.client.setToken({ access_token: token });
```

**Read Data**:
```javascript
const response = await gapi.client.sheets.spreadsheets.values.get({
  spreadsheetId: this.spreadsheetId,
  range: 'Loans!A2:O'
});
```

**Write Data**:
```javascript
await gapi.client.sheets.spreadsheets.values.append({
  spreadsheetId: this.spreadsheetId,
  range: 'Loans!A:O',
  valueInputOption: 'USER_ENTERED',
  resource: { values: [row] }
});
```

**Update Data**:
```javascript
await gapi.client.sheets.spreadsheets.values.update({
  spreadsheetId: this.spreadsheetId,
  range: `Loans!L${rowIndex}:N${rowIndex}`,
  valueInputOption: 'USER_ENTERED',
  resource: { values: [[value1, value2, value3]] }
});
```

### Google Drive API

**Upload File**:
```javascript
const formData = new FormData();
formData.append('metadata', new Blob([JSON.stringify(metadata)], 
  { type: 'application/json' }));
formData.append('file', file);

const response = await auth.makeAuthRequest(
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  { method: 'POST', body: formData }
);
```

**Make File Public**:
```javascript
await auth.makeAuthRequest(
  `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }
);
```

---

## 💾 State Management

### Current Approach: No State Library
- **Session State**: localStorage (user, token, spreadsheetId, folderId)
- **UI State**: DOM manipulation
- **Data State**: Fetched on-demand from Sheets

### Session Storage
```javascript
localStorage.setItem('user', JSON.stringify(user));
localStorage.setItem('tokenExpiry', timestamp);
localStorage.setItem('spreadsheetId', id);
localStorage.setItem('driveFolderId', id);
```

### Future Enhancement: Client-Side Cache
```javascript
// Proposed structure
const cache = {
  loans: {
    data: [...],
    timestamp: Date.now(),
    ttl: 300000  // 5 minutes
  },
  payments: {
    data: [...],
    timestamp: Date.now(),
    ttl: 300000
  }
};
```

---

## 🔐 Security Considerations

### Current Implementation
1. **OAuth 2.0**: Secure token-based authentication
2. **HTTPS**: All API calls over HTTPS
3. **Token Expiry**: 1-hour token lifetime
4. **Scopes**: Minimal required permissions
5. **Client-Side Only**: No backend to secure

### Limitations
1. **No Encryption**: Data stored in plain text in Sheets
2. **No Access Control**: Anyone with sheet access can view
3. **Client ID Public**: Exposed in source code (acceptable for OAuth)

### Recommended Enhancements
1. **Client-Side Encryption**: Encrypt sensitive fields before storing
2. **Session Timeout**: Auto-logout after inactivity
3. **Audit Log**: Track all data modifications
4. **Backup Strategy**: Regular automated backups

---

## 🚀 Performance Optimizations

### Current Optimizations
1. **Service Worker**: Cache-first strategy for static assets
2. **Lazy Script Loading**: Google APIs loaded on-demand
3. **Minimal Dependencies**: No heavy frameworks

### Planned Optimizations
1. **Lazy Loading**: Paginate large datasets
2. **Virtual Scrolling**: For very long lists
3. **Debounced Search**: Reduce re-renders
4. **Image Compression**: Resize before upload
5. **Data Caching**: Reduce API calls

---

## 🧪 Testing Strategy

### Current Status
- **Manual Testing**: Functional testing by developer
- **Browser Testing**: Chrome, Safari, Firefox
- **Mobile Testing**: iOS Safari, Android Chrome

### Recommended Testing
1. **Unit Tests**: Jest for utility functions
2. **Integration Tests**: API interaction tests
3. **E2E Tests**: Playwright/Cypress for user flows
4. **Performance Tests**: Lighthouse audits
5. **Accessibility Tests**: WAVE, axe

---

## 📦 Deployment Architecture

### GitHub Pages
```
GitHub Repository (master branch)
  ↓
GitHub Actions (auto-build)
  ↓
GitHub Pages CDN
  ↓
https://hemanth346.github.io/tracker_pwa/
```

### Service Worker Cache Strategy
```
Cache-First:
  - HTML, CSS, JS files
  - Images, icons
  - Manifest

Network-First:
  - Google API calls
  - User data
```

---

## 🔄 Offline Strategy

### Current Implementation
1. **Service Worker**: Caches static assets
2. **Offline Fallback**: Shows cached index.html
3. **Network Detection**: Skips Google API calls when offline

### Limitations
1. **No Offline Writes**: Can't add loans/payments offline
2. **No Sync Queue**: Changes not queued for later sync

### Recommended Enhancements
1. **Background Sync API**: Queue offline operations
2. **IndexedDB**: Store data locally
3. **Conflict Resolution**: Handle sync conflicts
4. **Offline Indicator**: Show connection status

---

## 📊 Monitoring & Analytics

### Current Status
- **No Analytics**: No tracking implemented
- **Console Logging**: Debug logs in development

### Recommended Implementation
1. **Error Tracking**: Sentry or similar
2. **Usage Analytics**: Google Analytics (privacy-friendly)
3. **Performance Monitoring**: Web Vitals
4. **User Feedback**: In-app feedback form

---

## � Recent Bug Fixes (v1.1.0 - December 31, 2025)

### Critical Issues Resolved
1. **Profile Picture Display**: Fixed undefined `userAvatar` variable in ui.js
   - Issue: JavaScript error when displaying Google profile pictures
   - Fix: Added proper DOM element selection `document.getElementById('user-avatar')`

2. **Smart Dropdowns**: Added missing datalist elements
   - Issue: Via and Received By dropdowns not functioning
   - Fix: Added `<datalist id="via-list">` and confirmed `received-by-list` exists

3. **Form Input Configuration**: Fixed amount step increments
   - Issue: Amount fields used step="0.01" instead of user-requested ₹1,000 increments
   - Fix: Changed to step="1000" in both loan and payment forms

4. **Code Quality**: Removed duplicate CSS injection
   - Issue: Dynamic spinner CSS injection when styles already exist in styles.css
   - Fix: Removed redundant style element creation in showBtnLoading()

5. **Error Handling**: Improved DOM element validation
   - Issue: Potential errors when DOM elements don't exist
   - Fix: Added null checks and warning messages

### Implementation Status Corrections
- **Payment Grouping**: Updated roadmap status from "Implemented" to "Not Implemented"
- **Documentation**: Synchronized actual implementation with roadmap

---

## �🔮 Future Architecture Considerations

### Scalability
- Current: Suitable for < 1000 loans, < 5000 payments
- Limitation: Google Sheets has 5M cell limit
- Solution: Migrate to Firebase/Supabase if needed

### Multi-User Support
- Current: Single-user app
- Enhancement: Share loans with co-lenders
- Implementation: Add user permissions in Sheets

### Real-Time Sync
- Current: Manual refresh required
- Enhancement: Real-time updates across devices
- Implementation: Firebase Realtime Database or Firestore

---

**Last Updated**: December 31, 2025  
**Version**: 1.1.0
