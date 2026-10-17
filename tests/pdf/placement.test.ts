import { describe, expect, it } from 'vitest'
import { clientToPdfPoint, createFieldPlacements, fitFieldPlacementPoint } from '../../lib/pdf/placement'
import { createDocumentPage } from '../../lib/pdf/document'
import { commitHistory, createHistory, undoHistory, redoHistory } from '../../lib/pdf/history'

describe('field placement', () => {
  it('creates independent IDs on multiple pages in one result', () => {
    const first = createDocumentPage({ pageIndex: 0, width: 600, height: 800, rotation: 0 }, [0, 0, 600, 800])
    const second = createDocumentPage({ pageIndex: 1, width: 300, height: 500, rotation: 0 }, [10, 20, 310, 520])
    let counter = 0
    const result = createFieldPlacements({ id: 'name', kind: 'name', label: 'Name', value: 'Ada' }, first, [first, second], { x: 50, y: 60 }, () => `item-${++counter}`)
    expect(result.elements).toMatchObject([{ id: 'item-1', pageId: first.id, x: 50, y: 60 }, { id: 'item-2', pageId: second.id, x: 60, y: 80 }])
    expect(result.outOfBoundsPageIds).toEqual([])
  })

  it('flags fields outside a smaller page', () => {
    const first = createDocumentPage({ pageIndex: 0, width: 600, height: 800, rotation: 0 }, [0, 0, 600, 800])
    const small = createDocumentPage({ pageIndex: 1, width: 100, height: 100, rotation: 0 }, [0, 0, 100, 100])
    const result = createFieldPlacements({ id: 'name', kind: 'name', label: 'Name', value: 'Ada' }, first, [small], { x: 50, y: 60 }, () => 'item')
    expect(result.outOfBoundsPageIds).toEqual([small.id])
  })

  it('fits a dragged field within every destination page and preserves crop offsets', () => {
    const first = createDocumentPage({ pageIndex: 0, width: 600, height: 800, rotation: 0 }, [0, 0, 600, 800])
    const second = createDocumentPage({ pageIndex: 1, width: 300, height: 500, rotation: 0 }, [10, 20, 310, 520])
    const field = { id: 'name', kind: 'name' as const, label: 'Name', value: 'Ada' }
    const fitted = fitFieldPlacementPoint(field, first, [first, second], { x: 590, y: 790 })
    expect(fitted).toEqual({ x: 120, y: 465 })
    const result = createFieldPlacements(field, first, [first, second], fitted!, () => 'item')
    expect(result.outOfBoundsPageIds).toEqual([])
    expect(result.elements).toMatchObject([{ x: 120, y: 465 }, { x: 130, y: 485 }])
  })

  it('reverts multi-page insertion in one history step', () => {
    const pages = [0, 1, 2].map(pageIndex => createDocumentPage({ pageIndex, width: 400, height: 600, rotation: 0 }, [0, 0, 400, 600]))
    let counter = 0
    const placed = createFieldPlacements({ id: 'name', kind: 'name', label: 'Name', value: 'Ada' }, pages[0], pages, { x: 30, y: 40 }, () => `id-${++counter}`)
    const history = commitHistory(createHistory<typeof placed.elements>([]), placed.elements)
    expect(undoHistory(history).present).toEqual([])
    expect(redoHistory(undoHistory(history)).present).toHaveLength(3)
  })

  it('maps DOM drop coordinates through the current viewport at any zoom', () => {
    const rect = { left: 100, top: 50, width: 600, height: 800 }
    for (const zoom of [0.5, 1, 2.5]) {
      const viewport = { width: 600 * zoom, height: 800 * zoom, transform: [zoom, 0, 0, -zoom, 0, 800 * zoom] }
      expect(clientToPdfPoint(250, 250, rect, viewport)).toEqual({ x: 150, y: 600 })
    }
  })

  it('preserves crop offsets and quarter-turn transforms', () => {
    const viewport = { width: 500, height: 600, transform: [0, 2, 2, 0, -20, -40] }
    expect(clientToPdfPoint(150, 70, { left: 100, top: 50, width: 250, height: 300 }, viewport)).toEqual({ x: 40, y: 60 })
  })
})
