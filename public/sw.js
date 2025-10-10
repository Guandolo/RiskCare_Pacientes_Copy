const CACHE_VERSION = 'riskcare-v2-' + new Date().getTime();
const CACHE_NAME = CACHE_VERSION;

// Install: Skip waiting para activar inmediatamente
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);
  self.skipWaiting(); // Activa el nuevo SW inmediatamente
});

// Activate: Limpia caches antiguos y toma control inmediatamente
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
    }).then(() => {
      // Toma control de todos los clientes inmediatamente
      return self.clients.claim();
    })
  );
});

// Fetch: Network-first para HTML, Cache-first con network fallback para assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first para HTML y la página principal
  if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clona la respuesta para cachearla
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Si falla el network, intenta con cache
          return caches.match(request);
        })
    );
    return;
  }

  // Para JS, CSS y otros assets: Cache-first con network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidar en background
        fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response);
          });
        });
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
          cache.put(request, responseToCache);
        });

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
