'use client'

import { useEffect } from 'react'

export default function PwaSetup() {
  useEffect(() => {
    // Development chunks change on every edit; caching them would serve stale code.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error)
    })
  }, [])
  return null
}
