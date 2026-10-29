// ConvertPro service worker: keeps the app shell available offline.
// File processing and PDF export run on the server, so /api is never cached.
const VERSION = 'v1'
const SHELL_CACHE = `convertpro-shell-${VERSION}`
const ASSET_CACHE = `convertpro-assets-${VERSION}`
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE && key !== ASSET_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Network first so a deploy shows up immediately; the cached page is the offline fallback.
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || Response.error()
  }
}

// Hashed Next.js chunks never change, so the cached copy is always correct.
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

// Fonts, icons and the PDF.js worker keep stable URLs; serve the cached copy and refresh it.
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone())
    return response
  })
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined))
    return cached
  }
  return refresh
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
  } else if (/^\/(fonts|icons|pdfjs)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
