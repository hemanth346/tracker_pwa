# P2P Lending Tracker

A beautiful, modern progressive web app for tracking peer-to-peer lending activities. Built with vanilla JavaScript and Google Sheets as the backend.

## ✨ Features

- 📊 **Loan Management** - Track all your P2P lending activities
- 💵 **Payment Tracking** - Record interest and principal payments
- 📱 **Progressive Web App** - Install on any device, works offline
- ☁️ **Google Sheets Backend** - Direct access to your data
- 🖼️ **Image Attachments** - Upload pro notes and payment receipts
- 📈 **Auto Calculations** - Automatic interest tracking and calculations
- 🎨 **Modern UI** - Elegant design with glassmorphism and smooth animations

## 🚀 Quick Start

1. **Setup Google Cloud** (see [SETUP.md](SETUP.md) for detailed instructions)
   - Create a Google Cloud Project
   - Enable Google Sheets API and Google Drive API
   - Create OAuth 2.0 credentials

2. **Configure the App**
   ```javascript
   // Edit config.js
   GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com'
   ```

3. **Run Locally**
   ```bash
   python3 -m http.server 8080
   # or
   npx serve -p 8080
   ```

4. **Open in Browser**
   ```
   http://localhost:8080
   ```

## 📱 Installation

The app can be installed on any device:

- **Android**: Chrome menu → "Add to Home Screen"
- **iOS**: Safari Share → "Add to Home Screen"
- **Desktop**: Click the install button in the address bar

## 🏗️ Project Structure

```
p2p_progressive_webapp/
├── index.html              # Main app interface
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── config.js               # Configuration (add your Client ID here)
├── css/
│   └── styles.css         # Design system
├── js/
│   ├── app.js             # Main application
│   ├── auth.js            # Google authentication
│   ├── sheets.js          # Google Sheets integration
│   ├── drive.js           # Google Drive for images
│   └── ui.js              # UI components
└── images/
    └── icons/             # PWA icons
```

## 📊 Data Schema

### Loans
- Borrower details and contact information
- Amount, interest rate, and terms
- Multiple contacts per borrower
- Status tracking (Active/Closed/Defaulted)
- Automatic calculations (total interest, paid till month)
- Image attachments for pro notes

### Payments
- Payment date and amount
- Payment type and method
- Recipient information
- Image attachments for receipts
- Automatic loan updates

## 🔒 Security & Privacy

- Data stored in **your** Google Drive
- OAuth 2.0 secure authentication
- No third-party servers
- You control all permissions

## 🛠️ Technologies

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Google Sheets API, Google Drive API
- **Auth**: Google Identity Services (OAuth 2.0)
- **PWA**: Service Workers, Web App Manifest

## 📖 Documentation

- [Setup Guide](SETUP.md) - Detailed setup instructions
- [Implementation Plan](/.gemini/antigravity/brain/a02226ce-6011-4240-b2a7-5526b2ff7b5e/implementation_plan.md) - Technical details

## 💡 Tips

- Access your data anytime via Google Sheets
- Create custom reports using Google Sheets formulas
- Use the search feature in Google Sheets to find specific loans
- Export data to Excel or CSV for analysis

## 🤝 Support

For issues or questions, check the [SETUP.md](SETUP.md) troubleshooting section.

---

Made with ❤️ for better P2P lending management
