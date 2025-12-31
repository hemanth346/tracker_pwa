# Loan Tracker

A beautiful, modern progressive web app for tracking lending activities. Built with vanilla JavaScript and Google Sheets as the backend.

**🎉 Latest Update (v1.1.0 - Dec 31, 2025)**: All critical bugs from Phase 1 deployment have been fixed!

## ✨ Features

- 📊 **Loan Management** - Track all your lending activities ✅
- 💵 **Payment Tracking** - Record interest and principal payments ✅
- 📱 **Progressive Web App** - Install on any device, works offline ✅
- ☁️ **Google Sheets Backend** - Direct access to your data ✅
- 🖼️ **Image Attachments** - Upload pro notes and payment receipts ✅
- 📈 **Auto Calculations** - Automatic interest tracking and calculations ✅
- 🎨 **Modern UI** - Elegant design with glassmorphism and smooth animations ✅
- 📝 **Loan Details Modal** - Click any loan to view/edit details ✅
- 🔄 **Smart Dropdowns** - Auto-populated from existing data ✅
- ⚡ **Loading States** - Visual feedback during operations ✅
- 📊 **Payment Grouping** - Collapsible groups with filters and summaries ✅

### Recently Fixed (v1.1.0)
- ✅ Profile picture display issues
- ✅ Smart dropdown functionality 
- ✅ Amount field ₹1,000 increments
- ✅ JavaScript errors and undefined variables
- ✅ Code quality improvements

### New in v1.1.0
- ✅ **Payment Grouping Feature** - Group payments by Loan ID, Borrower, or Month with collapsible sections and filtering options

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

## Deployment
The app is deployed on GitHub Pages. You can find the deployed version at [https://hemanth346.github.io/tracker_pwa/](https://hemanth346.github.io/tracker_pwa/).

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Next Session Guide](docs/next_session_guide.md)** - Quick start for resuming development
- **[Enhancements Roadmap](docs/enhancements_roadmap.md)** - Planned features and improvements
- **[Technical Architecture](docs/technical_architecture.md)** - System design and architecture
- **[Changelog](docs/changelog.md)** - Version history and updates

See the [docs README](docs/README.md) for a complete index.


## 🤝 Support

For issues or questions, check the [SETUP.md](SETUP.md) troubleshooting section.

---

Made with ❤️ for better lending management
