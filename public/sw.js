// Versión estática del cache - cambiar manualmente cuando se necesite actualizar
const CACHE_VERSION = 'riskcare-v4-20251027';
const CACHE_NAME = CACHE_VERSION;

// Install: NO usar skipWaiting automáticamente para evitar recargas forzadas
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);
  // Removido: self.skipWaiting() - solo se activa cuando el usuario cierra todas las pestañas
});

// Activate: Limpia caches antiguos solo cuando se activa naturalmente
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    // Removido: clients.claim() - evita tomar control forzado de pestañas existentes
  );
});

// Fetch: Network-only for POST/JSON/API, Network-first for HTML, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-http(s) schemes (e.g., chrome-extension) and any non-GET requests
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || request.method !== 'GET') {
    return; // Let the browser handle it normally
  }

  const accept = request.headers.get('accept') || '';

  // Bypass caching for backend/API/JSON/SSE requests (network-only)
  const isBackend =
    url.pathname.startsWith('/functions/v1/') ||
    url.pathname.startsWith('/rest/v1/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase');
  const isJSON = accept.includes('application/json');
  const isSSE = accept.includes('text/event-stream');

  if (isBackend || isJSON || isSSE) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Network-first para HTML y la página principal
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clona la respuesta para cachearla
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          }).catch(() => {});
          return response;
        })
        .catch(() => {
          // Si falla el network, intenta con cache
          return caches.match(request);
        })
    );
    return;
  }

  // Para assets estáticos: Cache-first con revalidación en background
  const isStaticAsset = ['script', 'style', 'image', 'font'].includes(request.destination);
  if (!isStaticAsset) {
    // Anything else: network only to avoid caching dynamic data
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidar en background
        fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response).catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
        return cachedResponse;
      }

      // Si no está en cache, fetch y cachea
      return fetch(request).then((response) => {
        // Solo cachea respuestas válidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache).catch(() => {});
        }).catch(() => {});

        return response;
      });
    })
  );
});

// Escucha mensajes para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
