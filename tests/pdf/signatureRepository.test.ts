import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteLocalSignature, listLocalSignatures, saveLocalSignature } from '../../lib/pdf/signatureRepository'
import type { SignatureRecord } from '../../lib/pdf/signatures'

describe('local signature library', () => {
  it('commits a blob, reopens it, renames it, and deletes only the library entry', async () => {
    const record: SignatureRecord = { id: 'signature-test', name: 'First name', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), mimeType: 'image/png', source: { kind: 'draw', strokes: [[{ x: 1, y: 2 }]] } }
    await saveLocalSignature(record)
    expect((await listLocalSignatures()).find(item => item.id === record.id)?.blob.size).toBe(3)
    await saveLocalSignature({ ...record, name: 'Renamed' })
    expect((await listLocalSignatures()).find(item => item.id === record.id)?.name).toBe('Renamed')
    await deleteLocalSignature(record.id)
    expect((await listLocalSignatures()).some(item => item.id === record.id)).toBe(false)
  })
})
