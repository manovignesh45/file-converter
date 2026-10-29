export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export type ZoomFit = 'width' | 'page'

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100
}

/** The next preset above or below `zoom`, so button steps land on familiar values. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const next = direction > 0
    ? ZOOM_PRESETS.find(preset => preset > zoom + 0.001)
    : [...ZOOM_PRESETS].reverse().find(preset => preset < zoom - 0.001)
  return next ?? (direction > 0 ? MAX_ZOOM : MIN_ZOOM)
}

/**
 * Zoom for one Ctrl+wheel or trackpad-pinch event. Pinches send many small deltas
 * and mouse wheels send large ones, so the delta is capped before it is applied.
 */
export function wheelZoom(zoom: number, deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY
  const capped = Math.max(-50, Math.min(50, pixels))
  return clampZoom(zoom * Math.exp(-capped * 0.004))
}

export function fitZoom(
  fit: ZoomFit,
  page: { width: number; height: number },
  container: { width: number; height: number },
  padding: { x: number; y: number },
): number {
  const byWidth = (container.width - padding.x * 2) / page.width
  if (fit === 'width') return clampZoom(byWidth)
  return clampZoom(Math.min(byWidth, (container.height - padding.y * 2) / page.height))
}

/** A point on a page, as fractions of its size, and where it sat in the scroll viewport. */
export interface ZoomAnchor { pageIndex: number; fractionX: number; fractionY: number; viewportX: number; viewportY: number }

/** Scroll position that puts the anchored page point back under the same viewport point. */
export function anchoredScroll(page: { left: number; top: number; width: number; height: number }, anchor: ZoomAnchor) {
  return {
    left: Math.max(0, page.left + anchor.fractionX * page.width - anchor.viewportX),
    top: Math.max(0, page.top + anchor.fractionY * page.height - anchor.viewportY),
  }
}

/** Keyboard zoom intent for Ctrl/Cmd shortcuts, using `code` so layouts without a + key still work. */
export function zoomShortcut(event: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): 'in' | 'out' | 'reset' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  if (['+', '='].includes(event.key) || ['Equal', 'NumpadAdd'].includes(event.code ?? '')) return 'in'
  if (['-', '_'].includes(event.key) || ['Minus', 'NumpadSubtract'].includes(event.code ?? '')) return 'out'
  if (event.key === '0' || ['Digit0', 'Numpad0'].includes(event.code ?? '')) return 'reset'
  return null
}
