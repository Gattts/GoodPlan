import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exampleTrip } from '@/domain/example'
import type { Trip } from '@/domain/types'
import { RATES } from '@/test/fixtures'
import { blockedStorage, memoryStorage } from '@/test/storage'

import {
  createLocalTripStore,
  createPrefsStore,
  createSaveStatus,
  DEFAULT_PREFS,
  loadRatesCache,
  RATES_KEY,
  saveRatesCache,
  TRIP_KEY,
} from './stores'

const today = () => '2026-11-05'
const t1: Trip = { ...exampleTrip('2026-11-05'), people: 3, isExample: false }
const t2: Trip = { ...exampleTrip('2026-11-05'), people: 4, isExample: false }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('viagem no navegador', () => {
  it('sem nada salvo, começa pela viagem de exemplo', () => {
    expect(createLocalTripStore(memoryStorage(), today, createSaveStatus()).load()).toEqual(exampleTrip('2026-11-05'))
  })

  it('grava 300 ms depois da última mudança, no formato com versão', () => {
    const storage = memoryStorage()
    const store = createLocalTripStore(storage, today, createSaveStatus())
    store.save(t1)
    store.save(t2)
    expect(store.load()).toEqual(t2) // a tela já usa o valor novo
    vi.advanceTimersByTime(299)
    expect(storage.get(TRIP_KEY)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(JSON.parse(storage.get(TRIP_KEY)!)).toEqual({ v: 1, trip: t2 })
  })

  it('volta a ler o que estava salvo', () => {
    const storage = memoryStorage()
    storage.set(TRIP_KEY, JSON.stringify({ v: 1, trip: t1 }))
    expect(createLocalTripStore(storage, today, createSaveStatus()).load()).toEqual(t1)
  })

  it.each(['{quebrado', '{"v":2,"trip":{}}', JSON.stringify({ v: 1, trip: { ...t1, people: 50 } })])(
    'dado inválido (%s) volta ao exemplo',
    (raw) => {
      const storage = memoryStorage()
      storage.set(TRIP_KEY, raw)
      expect(createLocalTripStore(storage, today, createSaveStatus()).load()).toEqual(exampleTrip('2026-11-05'))
    },
  )

  it('armazenamento bloqueado: guarda em memória e avisa', () => {
    const storage = blockedStorage()
    expect(storage.available).toBe(false)
    const status = createSaveStatus()
    const store = createLocalTripStore(storage, today, status)
    expect(status.get()).toBe('failed')
    store.save(t1)
    vi.runAllTimers()
    expect(store.load()).toEqual(t1)
    expect(status.get()).toBe('failed')
  })

  it('cota cheia ao gravar também avisa', () => {
    const storage = memoryStorage((key) => key === TRIP_KEY)
    const status = createSaveStatus()
    const store = createLocalTripStore(storage, today, status)
    store.save(t1)
    vi.runAllTimers()
    expect(status.get()).toBe('failed')
    expect(store.load()).toEqual(t1)
  })

  it('avisa quem está ouvindo quando a viagem muda, nesta aba ou em outra', () => {
    const storage = memoryStorage()
    const store = createLocalTripStore(storage, today, createSaveStatus())
    const listener = vi.fn()
    store.subscribe(listener)
    store.save(t1)
    expect(listener).toHaveBeenLastCalledWith(t1)
    storage.set(TRIP_KEY, JSON.stringify({ v: 1, trip: t2 })) // outra aba gravou
    window.dispatchEvent(new StorageEvent('storage', { key: TRIP_KEY }))
    expect(listener).toHaveBeenLastCalledWith(t2)
    expect(store.load()).toEqual(t2)
  })
})

describe('preferências e cotações guardadas', () => {
  it('preferências: padrão e leitura', () => {
    const storage = memoryStorage()
    const prefs = createPrefsStore(storage, createSaveStatus())
    expect(prefs.load()).toEqual(DEFAULT_PREFS)
    prefs.save({ ...DEFAULT_PREFS, theme: 'dark' })
    vi.advanceTimersByTime(300)
    expect(createPrefsStore(storage, createSaveStatus()).load().theme).toBe('dark')
  })

  it('cotações: grava com a data de quando chegaram e lê de volta', () => {
    const storage = memoryStorage()
    expect(loadRatesCache(storage)).toBeNull()
    saveRatesCache(storage, RATES, new Date('2026-11-05T20:00:00Z'))
    expect(loadRatesCache(storage)).toEqual({ data: RATES, savedAt: '2026-11-05T20:00:00.000Z' })
    storage.set(RATES_KEY, '{"v":1,"data":{}}')
    expect(loadRatesCache(storage)).toBeNull()
  })
})
