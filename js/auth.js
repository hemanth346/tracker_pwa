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
            // Check if CONFIG is available
            if (typeof CONFIG === 'undefined') {
                console.error('CONFIG is not defined');
                reject(new Error('CONFIG not loaded'));
                return;
            }

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
            this.handleAuthError('Authentication not ready. Please refresh the page.');
            return;
        }

        // Request access token without mandatory consent for better PWA experience
        this.tokenClient.requestAccessToken({ prompt: '' });
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
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpiry');

        // Trigger sign out event
        window.dispatchEvent(new CustomEvent('auth:signout'));
    }

    // Check for existing session
    checkExistingSession() {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('accessToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');

        if (savedUser && savedToken && tokenExpiry) {
            const expiryTime = parseInt(tokenExpiry);
            const now = Date.now();

            // Check if token is still valid (not expiring in next 5 minutes)
            if (now < (expiryTime - 300000)) {
                this.user = JSON.parse(savedUser);
                this.accessToken = savedToken;
                console.log('[Auth] Restored session from localStorage');

                // Set up auto-refresh
                this.setupAutoRefresh(expiryTime - now);

                window.dispatchEvent(new CustomEvent('auth:success', { detail: this.user }));
                return true;
            } else {
                console.log('[Auth] Token expired or expiring soon, attempting silent refresh');
                // Try silent refresh if client is ready
                if (this.tokenClient) {
                    this.tokenClient.requestAccessToken({ prompt: '' });
                    return true; // Assume success for UI while refreshing
                } else {
                    this.signOut();
                }
            }
        }
        return false;
    }

    // Handle successful authentication
    async onAuthSuccess() {
        try {
            console.log('[Auth] Fetching user info...');

            // Fetch user info
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user info: ${response.status}`);
            }

            this.user = await response.json();

            // Save to session (token expires in 1 hour)
            const expiresIn = 3600000;
            localStorage.setItem('user', JSON.stringify(this.user));
            localStorage.setItem('accessToken', this.accessToken);
            localStorage.setItem('tokenExpiry', (Date.now() + expiresIn).toString());

            // Set up auto-refresh (5 minutes before expiry)
            this.setupAutoRefresh(expiresIn);

            // Trigger success event
            window.dispatchEvent(new CustomEvent('auth:success', { detail: this.user }));
        } catch (error) {
            console.error('[Auth] Error in onAuthSuccess:', error);
            this.handleAuthError(error.message);
        }
    }

    setupAutoRefresh(msUntilExpiry) {
        // Clear existing timer
        if (this.refreshTimer) clearTimeout(this.refreshTimer);

        // Refresh 5 minutes before actual expiry
        const refreshIn = Math.max(0, msUntilExpiry - 300000);
        console.log(`[Auth] Scheduling token refresh in ${Math.round(refreshIn / 60000)} minutes`);

        this.refreshTimer = setTimeout(() => {
            console.log('[Auth] Auto-refreshing token...');
            if (this.tokenClient) {
                this.tokenClient.requestAccessToken({ prompt: '' });
            }
        }, refreshIn);
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
