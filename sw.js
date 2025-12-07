// Service Worker for P2P Lending Tracker PWA
const CACHE_NAME = 'p2p-lending-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/auth.js',
    './js/sheets.js',
    './js/drive.js',
    './js/ui.js',
    './config.js',
    './manifest.json',
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip Google API requests - always use network
    if (request.url.includes('googleapis.com') ||
        request.url.includes('accounts.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page if available
                        return caches.match('/index.html');
                    });
            })
    );
});

// Background sync for pending operations
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncPendingData());
    }
});

async function syncPendingData() {
    // This will be called when the app comes back online
    // Implement sync logic here if needed
    console.log('Syncing pending data...');
}
