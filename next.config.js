/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output to avoid trace collection issues
  output: 'standalone',

  // PDF to Word extracts text with PDF.js on the server; load it from node_modules instead of bundling it.
  serverExternalPackages: ['pdfjs-dist'],

  webpack(config) {
    // PDF.js's unminified build declares __webpack_exports__, which collides
    // with Next 15's Webpack 5.98 eval wrapper before getDocument can run.
    // The minified build renames those internals. Match only the package root
    // so both editor imports are fixed without affecting CSS or worker paths.
    // https://github.com/webpack/webpack/issues/20095
    config.resolve.alias['pdfjs-dist$'] = require.resolve('pdfjs-dist/build/pdf.min.mjs')
    return config
  },
  
  // Configure external domains if needed
  images: {
    domains: ['fonts.gstatic.com', 'fonts.googleapis.com'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';"
          }
        ],
      },
      {
        // Browsers must always fetch the latest service worker to pick up new deploys.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || 'same-origin'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
