// Google Authentication Module
class Auth {
    constructor() {
        this.user = null;
        this.tokenClient = null;
        this.accessToken = null;
    }

    // Initialize Google Identity Services
    async init() {
        return new Promise((resolve, reject) => {
            // Load Google Identity Services
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                this.initializeGIS();
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    initializeGIS() {
        console.log('[Auth] Initializing Google Identity Services...');
        console.log('[Auth] Client ID:', CONFIG.GOOGLE_CLIENT_ID);

        // Initialize the token client
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            scope: CONFIG.SCOPES.join(' ') + ' https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            callback: (response) => {
                if (response.error) {
                    console.error('[Auth] Token error:', response);
                    this.handleAuthError(response.error);
                    return;
                }
                console.log('[Auth] Token received successfully');
                this.accessToken = response.access_token;
                this.onAuthSuccess();
            },
        });

        // Check if user is already signed in
        this.checkExistingSession();
    }

    // Sign in with Google
    signIn() {
        if (!this.tokenClient) {
            console.error('Token client not initialized');
            return;
        }

        // Request access token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    // Sign out
    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken, () => {
                console.log('Access token revoked');
            });
        }

        this.user = null;
        this.accessToken = null;

        // Clear session
        localStorage.removeItem('user');
        localStorage.removeItem('tokenExpiry');

        // Trigger sign out event
        window.dispatchEvent(new CustomEvent('auth:signout'));
    }

    // Check for existing session
    checkExistingSession() {
        const savedUser = localStorage.getItem('user');
        const tokenExpiry = localStorage.getItem('tokenExpiry');

        if (savedUser && tokenExpiry) {
            const expiryTime = parseInt(tokenExpiry);
            if (Date.now() < expiryTime) {
                this.user = JSON.parse(savedUser);
                // Token might still be valid, try to use it
                // In production, you'd want to refresh the token
                window.dispatchEvent(new CustomEvent('auth:success', { detail: this.user }));
            } else {
                // Token expired, clear session
                this.signOut();
            }
        }
    }

    // Handle successful authentication
    async onAuthSuccess() {
        try {
            console.log('[Auth] Fetching user info...');
            console.log('[Auth] Access token:', this.accessToken ? 'Present' : 'Missing');

            // Fetch user info
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            console.log('[Auth] User info response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Auth] User info error response:', errorText);
                throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
            }

            this.user = await response.json();
            console.log('[Auth] User info received:', this.user);

            // Save to session (token expires in 1 hour)
            localStorage.setItem('user', JSON.stringify(this.user));
            localStorage.setItem('tokenExpiry', (Date.now() + 3600000).toString());

            // Trigger success event
            console.log('[Auth] Triggering auth:success event');
            window.dispatchEvent(new CustomEvent('auth:success', { detail: this.user }));
        } catch (error) {
            console.error('[Auth] Error in onAuthSuccess:', error);
            this.handleAuthError(error.message);
        }
    }

    // Handle authentication errors
    handleAuthError(error) {
        console.error('Authentication error:', error);
        window.dispatchEvent(new CustomEvent('auth:error', { detail: error }));
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Get access token
    getAccessToken() {
        return this.accessToken;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.user && !!this.accessToken;
    }

    // Make authenticated API request
    async makeAuthRequest(url, options = {}) {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const headers = {
            ...options.headers,
            Authorization: `Bearer ${this.accessToken}`,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            // Token expired, sign out
            this.signOut();
            throw new Error('Session expired. Please sign in again.');
        }

        return response;
    }
}

// Export singleton instance
const auth = new Auth();
