/**
 * Viagem e preferências guardadas no navegador. O valor atual fica em memória (a tela muda na hora) e é gravado
 * 300 ms depois da última mudança. A parte 2 troca o TripStore por um que salva na conta.
 */
import type { ZodType } from 'zod'

import { exampleTrip } from '@/domain/example'
import type { Prefs, Trip } from '@/domain/types'
import type { RatesData } from '@/lib/api'

import type { SafeStorage } from './safe'
import { prefsFileSchema, ratesFileSchema, tripFileSchema } from './schemas'

export const TRIP_KEY = 'goodplan:trip'
export const PREFS_KEY = 'goodplan:prefs'
export const RATES_KEY = 'goodplan:rates'
export const SAVE_DELAY_MS = 300

export const DEFAULT_PREFS: Prefs = {
  calc: { amount: '100', from: null, to: 'BRL' },
  fees: { iof: 3.5, spread: 0 },
  customRates: {},
  theme: 'system',
}

export type SaveStatus = 'local' | 'failed'

export type SaveStatusStore = {
  get(): SaveStatus
  set(status: SaveStatus): void
  subscribe(listener: () => void): () => void
}

export function createSaveStatus(initial: SaveStatus = 'local'): SaveStatusStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(status) {
      if (status === current) return
      current = status
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type Store<T> = {
  load(): T
  save(value: T): void
  subscribe(listener: (value: T) => void): () => void
}

export type TripStore = Store<Trip>
export type PrefsStore = Store<Prefs>

type StoreOptions<T> = {
  storage: SafeStorage
  key: string
  status: SaveStatusStore
  events: EventTarget
  read: (json: unknown) => T | null
  write: (value: T) => string
  fallback: () => T
}

function createStore<T>({ storage, key, status, events, read, write, fallback }: StoreOptions<T>): Store<T> {
  let current: T | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<(value: T) => void>()
  if (!storage.available) status.set('failed')

  const readStored = (): T => {
    const raw = storage.get(key)
    if (raw === null) return fallback()
    try {
      return read(JSON.parse(raw)) ?? fallback()
    } catch {
      return fallback()
    }
  }
  const notify = (value: T) => listeners.forEach((listener) => listener(value))

  // Outra aba gravou: lê de novo e avisa a tela.
  events.addEventListener('storage', (event) => {
    if ((event as StorageEvent).key !== key) return
    current = readStored()
    notify(current)
  })

  return {
    load() {
      current ??= readStored()
      return current
    },
    save(value) {
      current = value
      notify(value)
      clearTimeout(timer)
      timer = setTimeout(() => {
        status.set(storage.set(key, write(value)) ? 'local' : 'failed')
      }, SAVE_DELAY_MS)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function parseWith<T>(schema: ZodType<T>) {
  return (json: unknown): T | null => {
    const result = schema.safeParse(json)
    return result.success ? result.data : null
  }
}

export function createLocalTripStore(
  storage: SafeStorage,
  today: () => string,
  status: SaveStatusStore,
  events: EventTarget = window,
): TripStore {
  const parseFile = parseWith(tripFileSchema)
  return createStore<Trip>({
    storage,
    key: TRIP_KEY,
    status,
    events,
    read: (json) => parseFile(json)?.trip ?? null,
    write: (trip) => JSON.stringify({ v: 1, trip }),
    fallback: () => exampleTrip(today()),
  })
}

export function createPrefsStore(
  storage: SafeStorage,
  status: SaveStatusStore,
  events: EventTarget = window,
): PrefsStore {
  const parseFile = parseWith(prefsFileSchema)
  return createStore<Prefs>({
    storage,
    key: PREFS_KEY,
    status,
    events,
    read: (json) => parseFile(json)?.prefs ?? null,
    write: (prefs) => JSON.stringify({ v: 1, prefs }),
    fallback: () => DEFAULT_PREFS,
  })
}

export type CachedRates = { data: RatesData; savedAt: string }

/** Última cotação recebida: aparece na hora enquanto a API acorda. */
export function loadRatesCache(storage: SafeStorage): CachedRates | null {
  const raw = storage.get(RATES_KEY)
  if (raw === null) return null
  try {
    const result = ratesFileSchema.safeParse(JSON.parse(raw))
    return result.success ? { data: result.data.data, savedAt: result.data.savedAt } : null
  } catch {
    return null
  }
}

export function saveRatesCache(storage: SafeStorage, data: RatesData, now: Date): void {
  storage.set(RATES_KEY, JSON.stringify({ v: 1, savedAt: now.toISOString(), data }))
}
