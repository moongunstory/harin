const CACHE_NAME = 'mbti-harin-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    // Ignore non-http/https protocols
    if (!url.protocol.startsWith('http')) return;
    // Ignore external APIs like Firebase to ensure real-time connections aren't cached incorrectly
    if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com') || url.hostname.includes('trongrid.io') || url.hostname.includes('toon.at')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // If the response is valid, cache it for next time
                if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
                    const clonedRes = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedRes);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Ignore network errors here to serve cache fallback below if applicable
            });
            
            // Stale-While-Revalidate: Return cached response immediately while network fetch runs in background
            return cachedResponse || fetchPromise;
        })
    );
});
