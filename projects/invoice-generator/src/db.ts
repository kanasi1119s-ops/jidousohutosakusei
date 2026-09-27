import type { Client, Invoice } from './invoice'
import { DEFAULT_NUMBERING, type NumberingState } from './numbering'
import { DEFAULT_PROFILE, type AppData, type Profile } from './storage'

const DB_NAME = 'invoice-generator-db'
const DB_VERSION = 1
const META_KEY = 'app'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('invoices')) db.createObjectStore('invoices', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDBのオープンに失敗しました。'))
  })
}

function tx<T>(db: IDBDatabase, storeNames: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode)
    let result: T
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error ?? new Error('データベース操作に失敗しました。'))
    transaction.onabort = () => reject(transaction.error ?? new Error('データベース操作が中断されました。'))
    Promise.resolve(fn(transaction))
      .then((r) => {
        result = r
      })
      .catch(reject)
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('データベース操作に失敗しました。'))
  })
}

export interface MetaRecord {
  profile: Profile
  numbering: NumberingState
}

export async function getMeta(): Promise<MetaRecord> {
  const db = await openDb()
  return tx(db, ['meta'], 'readonly', async (t) => {
    const store = t.objectStore('meta')
    const value = await reqToPromise(store.get(META_KEY))
    return (value as MetaRecord | undefined) ?? { profile: DEFAULT_PROFILE, numbering: DEFAULT_NUMBERING }
  })
}

export async function saveMeta(meta: MetaRecord): Promise<void> {
  const db = await openDb()
  await tx(db, ['meta'], 'readwrite', (t) => {
    t.objectStore('meta').put(meta, META_KEY)
  })
}

export async function listClients(): Promise<Client[]> {
  const db = await openDb()
  return tx(db, ['clients'], 'readonly', (t) => reqToPromise(t.objectStore('clients').getAll()))
}

export async function saveClient(client: Client): Promise<void> {
  const db = await openDb()
  await tx(db, ['clients'], 'readwrite', (t) => {
    t.objectStore('clients').put(client)
  })
}

export async function deleteClient(id: string): Promise<void> {
  const db = await openDb()
  await tx(db, ['clients'], 'readwrite', (t) => {
    t.objectStore('clients').delete(id)
  })
}

export async function listInvoices(): Promise<Invoice[]> {
  const db = await openDb()
  const invoices = await tx(db, ['invoices'], 'readonly', (t) => reqToPromise(t.objectStore('invoices').getAll()))
  return invoices.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  const db = await openDb()
  await tx(db, ['invoices'], 'readwrite', (t) => {
    t.objectStore('invoices').put(invoice)
  })
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await openDb()
  await tx(db, ['invoices'], 'readwrite', (t) => {
    t.objectStore('invoices').delete(id)
  })
}

export async function exportAll(): Promise<AppData> {
  const [meta, clients, invoices] = await Promise.all([getMeta(), listClients(), listInvoices()])
  return { formatVersion: 1, profile: meta.profile, numbering: meta.numbering, clients, invoices }
}

export async function importAll(data: AppData): Promise<void> {
  const db = await openDb()
  await tx(db, ['meta', 'clients', 'invoices'], 'readwrite', (t) => {
    t.objectStore('meta').put({ profile: data.profile, numbering: data.numbering }, META_KEY)
    const clientStore = t.objectStore('clients')
    clientStore.clear()
    data.clients.forEach((c) => clientStore.put(c))
    const invoiceStore = t.objectStore('invoices')
    invoiceStore.clear()
    data.invoices.forEach((i) => invoiceStore.put(i))
  })
}
