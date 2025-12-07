// Configuration for P2P Lending Tracker
// IMPORTANT: Replace YOUR_GOOGLE_CLIENT_ID_HERE with your actual Client ID from Google Cloud Console

const CONFIG = {
    // Get this from Google Cloud Console > APIs & Services > Credentials
    // https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: '973480281044-71i1lgdcje96e6llpd5lloum4dd92mjh.apps.googleusercontent.com',


    // Leave empty for auto-creation of spreadsheet
    SPREADSHEET_ID: '',

    // Google API Scopes (DO NOT MODIFY)
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
