// Configuration for P2P Lending Tracker
// Copy this file to config.js and fill in your credentials

const CONFIG = {
  // Get these from Google Cloud Console
  // https://console.cloud.google.com
  
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com',
  
  // The spreadsheet will be created automatically on first use
  // You can also specify an existing spreadsheet ID here
  SPREADSHEET_ID: '', // Leave empty for auto-creation
  
  // Google API Scopes
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
  
  // App Settings
  APP_NAME: 'P2P Lending Tracker',
  SPREADSHEET_NAME: 'P2P Lending Data',
  DRIVE_FOLDER_NAME: 'P2P Lending Attachments'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
