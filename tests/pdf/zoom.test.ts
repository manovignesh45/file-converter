import { describe, expect, it } from 'vitest'
import { anchoredScroll, clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, stepZoom, wheelZoom, zoomShortcut } from '../../lib/pdf/zoom'

const key = (keyName: string, code: string, modifiers: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = { ctrlKey: true }) =>
  ({ key: keyName, code, ctrlKey: false, metaKey: false, altKey: false, ...modifiers })

describe('editor zoom', () => {
  it('clamps and rounds zoom levels', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(1.23456)).toBe(1.23)
    expect(clampZoom(Number.NaN)).toBe(1)
  })

  it('steps between presets from any zoom level', () => {
    expect(stepZoom(1, 1)).toBe(1.25)
    expect(stepZoom(1, -1)).toBe(0.75)
    expect(stepZoom(1.1, 1)).toBe(1.25)
    expect(stepZoom(1.1, -1)).toBe(1)
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })

  it('zooms gently for pinches and caps large wheel steps', () => {
    expect(wheelZoom(1, -100)).toBeCloseTo(1.22, 2)
    expect(wheelZoom(1, -1000)).toBe(wheelZoom(1, -100))
    expect(wheelZoom(1, 100)).toBeLessThan(1)
    const pinch = wheelZoom(1, -4)
    expect(pinch).toBeGreaterThan(1)
    expect(pinch).toBeLessThan(1.03)
    expect(wheelZoom(1, -3, 1)).toBe(wheelZoom(1, -48))
  })

  it('fits a page to the available width or the whole page into view', () => {
    const page = { width: 612, height: 792 }
    expect(fitZoom('width', page, { width: 1272, height: 700 }, { x: 24, y: 32 })).toBe(2)
    expect(fitZoom('page', page, { width: 1272, height: 856 }, { x: 24, y: 32 })).toBe(1)
  })

  it('restores the anchored page point under the pointer', () => {
    const anchor = { pageIndex: 0, fractionX: 0.5, fractionY: 0.25, viewportX: 300, viewportY: 200 }
    expect(anchoredScroll({ left: 24, top: 32, width: 1224, height: 1584 }, anchor)).toEqual({ left: 336, top: 228 })
    expect(anchoredScroll({ left: 24, top: 32, width: 300, height: 400 }, anchor)).toEqual({ left: 0, top: 0 })
  })

  it('recognises zoom shortcuts across keyboard layouts', () => {
    expect(zoomShortcut(key('=', 'Equal'))).toBe('in')
    expect(zoomShortcut(key('+', 'Equal'))).toBe('in')
    expect(zoomShortcut(key('+', 'NumpadAdd'))).toBe('in')
    expect(zoomShortcut(key('-', 'Minus', { metaKey: true }))).toBe('out')
    expect(zoomShortcut(key('0', 'Digit0'))).toBe('reset')
    expect(zoomShortcut(key('ß', 'Minus'))).toBe('out')
    expect(zoomShortcut(key('=', 'Equal', {}))).toBeNull()
    expect(zoomShortcut(key('=', 'Equal', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(zoomShortcut(key('z', 'KeyZ'))).toBeNull()
  })
})
