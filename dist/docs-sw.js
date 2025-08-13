/**
 * Service Worker for LLM Runner Router Documentation
 * Provides caching and offline support for documentation pages
 */

const CACHE_NAME = 'llm-router-docs-v1';
const DOCS_CACHE = 'llm-router-docs-content-v1';

// Files to cache immediately
const STATIC_ASSETS = [
    '/enhanced-docs.html',
    '/enhanced-docs-api.js',
    '/docs-server.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/marked/5.1.1/marked.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => 
                    new Request(url, { mode: 'cors' })
                ));
            })
            .then(() => {
                console.log('SW: Installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('SW: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName !== DOCS_CACHE) {
                            console.log('SW: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('SW: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const { request } = event;
    const { url, method } = request;

    // Only handle GET requests
    if (method !== 'GET') return;

    // Handle documentation content requests
    if (url.includes('/docs/') && url.endsWith('.md')) {
        event.respondWith(handleDocsRequest(request));
        return;
    }

    // Handle API requests
    if (url.includes('/api/docs')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static assets
    if (STATIC_ASSETS.some(asset => url.includes(asset)) || 
        url.includes('.css') || 
        url.includes('.js') || 
        url.includes('.woff') || 
        url.includes('.woff2')) {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // Handle HTML pages
    if (url.includes('.html') || !url.includes('.')) {
        event.respondWith(handlePageRequest(request));
        return;
    }
});

// Handle documentation markdown requests
async function handleDocsRequest(request) {
    const cacheName = DOCS_CACHE;
    
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isStale(cachedResponse)) {
            return cachedResponse;
        }

        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful response
            const cache = await caches.open(cacheName);
            const responseClone = networkResponse.clone();
            
            // Add timestamp header for staleness check
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cached-at', Date.now().toString());
            
            const cachedResponse = new Response(await responseClone.text(), {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
            });
            
            cache.put(request, cachedResponse);
            return networkResponse;
        }
        
        // Return cached version if network fails
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('SW: Docs request failed', error);
        
        // Try to return cached version
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page or error
        return new Response(getOfflineContent(), {
            status: 200,
            headers: { 'Content-Type': 'text/markdown' }
        });
    }
}

// Handle API requests
async function handleApiRequest(request) {
    try {
        // Try network first for API requests
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses briefly
            const cache = await caches.open(DOCS_CACHE);
            const responseClone = networkResponse.clone();
            
            // Set short expiry for API responses
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cached-at', Date.now().toString());
            headers.set('sw-max-age', '300000'); // 5 minutes
            
            const cachedResponse = new Response(await responseClone.text(), {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
            });
            
            cache.put(request, cachedResponse);
            return networkResponse;
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('SW: API request failed', error);
        
        // Try cached version
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isStale(cachedResponse, 300000)) { // 5 min max age
            return cachedResponse;
        }
        
        // Return error response
        return new Response(JSON.stringify({
            error: 'Network unavailable',
            message: 'Please check your connection and try again.'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle static asset requests
async function handleStaticRequest(request) {
    try {
        // Cache first strategy for static assets
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Fetch from network and cache
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('SW: Static request failed', error);
        return new Response('Asset not available offline', { status: 404 });
    }
}

// Handle page requests
async function handlePageRequest(request) {
    try {
        // Network first for pages
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return networkResponse;
        
    } catch (error) {
        // Try cache first when network is down
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page
        return new Response(getOfflinePage(), {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Check if cached response is stale
function isStale(response, maxAge = 3600000) { // 1 hour default
    const cachedAt = response.headers.get('sw-cached-at');
    const responseMaxAge = response.headers.get('sw-max-age');
    
    if (!cachedAt) return true;
    
    const age = Date.now() - parseInt(cachedAt);
    const ageLimit = responseMaxAge ? parseInt(responseMaxAge) : maxAge;
    
    return age > ageLimit;
}

// Offline content for documentation
function getOfflineContent() {
    return `# Documentation Offline

This documentation page is not available offline.

Please connect to the internet to view the latest documentation.

## Available Offline

- Previously viewed pages may be cached
- Static assets (CSS, JS) are cached
- Core documentation structure

## Getting Back Online

1. Check your internet connection
2. Refresh the page when connected
3. The latest documentation will load automatically

---

LLM Runner Router Documentation System`;
}

// Offline HTML page
function getOfflinePage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - LLM Runner Router Docs</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafc;
            color: #1e293b;
        }
        .container {
            text-align: center;
            max-width: 500px;
            padding: 2rem;
        }
        h1 { color: #22c55e; margin-bottom: 1rem; }
        p { margin-bottom: 1.5rem; line-height: 1.6; }
        button {
            background: #22c55e;
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: #16a34a; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧠 You're Offline</h1>
        <p>The LLM Router Router documentation is not available right now. Please check your internet connection and try again.</p>
        <p>Some previously viewed pages may still be available in your cache.</p>
        <button onclick="location.reload()">Try Again</button>
    </div>
</body>
</html>`;
}

// Background sync for updates
self.addEventListener('sync', event => {
    if (event.tag === 'docs-update') {
        event.waitUntil(updateDocsCache());
    }
});

// Update documentation cache in background
async function updateDocsCache() {
    try {
        console.log('SW: Updating docs cache in background');
        
        const cache = await caches.open(DOCS_CACHE);
        const keys = await cache.keys();
        
        // Update stale entries
        const updatePromises = keys.map(async request => {
            const cachedResponse = await cache.match(request);
            if (isStale(cachedResponse)) {
                try {
                    const freshResponse = await fetch(request);
                    if (freshResponse.ok) {
                        await cache.put(request, freshResponse);
                    }
                } catch (error) {
                    console.warn('SW: Failed to update', request.url, error);
                }
            }
        });
        
        await Promise.allSettled(updatePromises);
        console.log('SW: Docs cache update complete');
        
    } catch (error) {
        console.error('SW: Failed to update docs cache', error);
    }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_DOCS') {
        // Cache specific docs
        event.waitUntil(
            cacheDocs(event.data.docs)
        );
    }
});

// Cache specific documentation files
async function cacheDocs(docList) {
    const cache = await caches.open(DOCS_CACHE);
    
    const cachePromises = docList.map(async docPath => {
        try {
            const request = new Request(docPath);
            const response = await fetch(request);
            
            if (response.ok) {
                await cache.put(request, response);
                console.log('SW: Cached doc', docPath);
            }
        } catch (error) {
            console.warn('SW: Failed to cache doc', docPath, error);
        }
    });
    
    await Promise.allSettled(cachePromises);
}

console.log('SW: LLM Runner Router Documentation Service Worker loaded');