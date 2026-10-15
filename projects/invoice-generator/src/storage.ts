import type { Invoice } from './invoice'

const KEY = 'invoice-generator:v1'

export function loadAll(): Invoice[] {
  try {
    const raw = localStorage.getItem(KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveAll(list: Invoice[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function upsert(list: Invoice[], inv: Invoice): Invoice[] {
  const i = list.findIndex((x) => x.id === inv.id)
  const next = list.slice()
  if (i >= 0) next[i] = inv
  else next.unshift(inv)
  return next
}
