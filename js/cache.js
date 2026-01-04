// Cache Manager for Performance Optimization
class CacheManager {
    constructor() {
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.cacheKey = 'loanTrackerCache';
        this.versionKey = 'loanTrackerCacheVersion';
        this.currentVersion = '1.1.0';
    }

    // Initialize cache - check version compatibility
    init() {
        const storedVersion = localStorage.getItem(this.versionKey);
        if (storedVersion !== this.currentVersion) {
            // Clear cache if version mismatch
            this.clearAll();
            localStorage.setItem(this.versionKey, this.currentVersion);
        }
    }

    // Get cache entry
    get(key) {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            if (!cacheData) return null;

            const cache = JSON.parse(cacheData);
            const entry = cache[key];

            if (!entry) return null;

            // Check if expired
            if (Date.now() > entry.expiry) {
                this.remove(key);
                return null;
            }

            return entry.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    // Set cache entry
    set(key, data, customTTL = null) {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            let cache = {};

            if (cacheData) {
                cache = JSON.parse(cacheData);
            }

            const ttl = customTTL || this.cacheTTL;
            cache[key] = {
                data: data,
                timestamp: Date.now(),
                expiry: Date.now() + ttl
            };

            localStorage.setItem(this.cacheKey, JSON.stringify(cache));

            // Trigger storage event for cross-tab synchronization
            window.dispatchEvent(new CustomEvent('cache:updated', {
                detail: { key, data }
            }));

        } catch (error) {
            console.error('Cache set error:', error);
            // If localStorage is full, clear cache and try again
            if (error.name === 'QuotaExceededError') {
                this.clearAll();
                this.set(key, data, customTTL);
            }
        }
    }

    // Remove cache entry
    remove(key) {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            if (!cacheData) return;

            const cache = JSON.parse(cacheData);
            delete cache[key];

            localStorage.setItem(this.cacheKey, JSON.stringify(cache));
        } catch (error) {
            console.error('Cache remove error:', error);
        }
    }

    // Clear all cache
    clearAll() {
        try {
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.versionKey);
            console.log('Cache cleared');
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    // Get cache statistics
    getStats() {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            if (!cacheData) return { entries: 0, size: 0 };

            const cache = JSON.parse(cacheData);
            const entries = Object.keys(cache).length;
            const size = new Blob([cacheData]).size;

            return {
                entries,
                size: Math.round(size / 1024) + ' KB',
                sizeBytes: size
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return { entries: 0, size: '0 KB', sizeBytes: 0 };
        }
    }

    // Check if cache entry exists and is valid
    isValid(key) {
        const entry = this.get(key);
        return entry !== null;
    }

    // Cleanup expired entries
    cleanup() {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            if (!cacheData) return;

            const cache = JSON.parse(cacheData);
            const now = Date.now();
            let cleaned = false;

            Object.keys(cache).forEach(key => {
                if (now > cache[key].expiry) {
                    delete cache[key];
                    cleaned = true;
                }
            });

            if (cleaned) {
                localStorage.setItem(this.cacheKey, JSON.stringify(cache));
            }
        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }

    // Get cache entry with metadata
    getWithMetadata(key) {
        try {
            const cacheData = localStorage.getItem(this.cacheKey);
            if (!cacheData) return null;

            const cache = JSON.parse(cacheData);
            const entry = cache[key];

            if (!entry) return null;

            // Check if expired
            if (Date.now() > entry.expiry) {
                this.remove(key);
                return null;
            }

            return {
                data: entry.data,
                timestamp: entry.timestamp,
                expiry: entry.expiry,
                age: Date.now() - entry.timestamp,
                ttl: entry.expiry - Date.now()
            };
        } catch (error) {
            console.error('Cache get with metadata error:', error);
            return null;
        }
    }

    // Background sync - store data for offline mode
    setBackgroundSync(key, data, action = 'update') {
        try {
            const syncKey = `${this.cacheKey}_sync`;
            const syncData = localStorage.getItem(syncKey);
            let syncQueue = [];

            if (syncData) {
                syncQueue = JSON.parse(syncData);
            }

            syncQueue.push({
                key,
                data,
                action,
                timestamp: Date.now(),
                synced: false
            });

            localStorage.setItem(syncKey, JSON.stringify(syncQueue));
        } catch (error) {
            console.error('Background sync set error:', error);
        }
    }

    // Get pending sync operations
    getPendingSync() {
        try {
            const syncKey = `${this.cacheKey}_sync`;
            const syncData = localStorage.getItem(syncKey);
            if (!syncData) return [];

            return JSON.parse(syncData).filter(item => !item.synced);
        } catch (error) {
            console.error('Get pending sync error:', error);
            return [];
        }
    }

    // Mark sync operation as completed
    markSyncCompleted(timestamp) {
        try {
            const syncKey = `${this.cacheKey}_sync`;
            const syncData = localStorage.getItem(syncKey);
            if (!syncData) return;

            let syncQueue = JSON.parse(syncData);
            syncQueue = syncQueue.map(item => {
                if (item.timestamp === timestamp) {
                    item.synced = true;
                }
                return item;
            });

            localStorage.setItem(syncKey, JSON.stringify(syncQueue));
        } catch (error) {
            console.error('Mark sync completed error:', error);
        }
    }
}

// Global cache manager instance
const cacheManager = new CacheManager();