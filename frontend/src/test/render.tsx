import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'

import App from '@/App'
import { exampleTrip } from '@/domain/example'
import type { Trip } from '@/domain/types'
import type { RatesData } from '@/lib/api'
import { StoresProvider, type Stores } from '@/state/stores-context'
import type { SafeStorage } from '@/storage/safe'
import { createLocalTripStore, createPrefsStore, createSaveStatus, TRIP_KEY } from '@/storage/stores'

import { stubFetch, type FakeReply } from './fetch'
import { memoryStorage } from './storage'

export type RenderAppOptions = {
  storage?: SafeStorage
  today?: string
  /** Viagem já salva antes de abrir o app (parte da viagem de exemplo, sem a marca de exemplo). */
  preset?: Partial<Trip>
  /** Resposta de /api/rates/latest (sem esta opção, a cotação nunca chega). */
  rates?: RatesData
  /** Outras rotas da API simulada, como as de aeroportos. */
  routes?: Record<string, FakeReply>
}

export function createTestStores({ storage = memoryStorage(), today = '2026-11-05', preset }: RenderAppOptions = {}) {
  if (preset) {
    const trip: Trip = { ...exampleTrip(today), isExample: false, ...preset }
    storage.set(TRIP_KEY, JSON.stringify({ v: 1, trip }))
  }
  const status = createSaveStatus(storage.available ? 'local' : 'failed')
  const stores: Stores = {
    storage,
    status,
    today,
    trip: createLocalTripStore(storage, () => today, status),
    prefs: createPrefsStore(storage, status),
  }
  return stores
}

export function TestProviders({ stores, children }: { stores: Stores; children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <StoresProvider value={stores}>{children}</StoresProvider>
    </QueryClientProvider>
  )
}

export function renderApp(options: RenderAppOptions = {}) {
  const routes: Record<string, FakeReply> = { '/api/health': { status: 'ok' }, ...options.routes }
  routes['/api/rates/latest'] =
    options.rates ?? options.routes?.['/api/rates/latest'] ?? (() => new Promise<Response>(() => undefined))
  const fetchMock = stubFetch(routes)
  const stores = createTestStores(options)
  const result = render(
    <TestProviders stores={stores}>
      <App />
    </TestProviders>,
  )
  return { ...result, stores, fetchMock }
}
