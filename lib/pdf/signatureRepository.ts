import type { SignatureRecord } from './signatures'

const DATABASE = 'convertpro-signatures'
const STORE = 'signatures'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = operation(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}

export function listLocalSignatures(): Promise<SignatureRecord[]> {
  return transact<SignatureRecord[]>('readonly', store => store.getAll())
}

export async function saveLocalSignature(record: SignatureRecord): Promise<void> {
  await transact('readwrite', store => store.put(record))
}

export async function deleteLocalSignature(id: string): Promise<void> {
  await transact('readwrite', store => store.delete(id))
}
