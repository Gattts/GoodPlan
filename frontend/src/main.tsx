import './styles/index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { todayLocal } from '@/domain/dates'
import { pingHealth } from '@/lib/api'
import { StoresProvider, type Stores } from '@/state/stores-context'
import { createSafeStorage } from '@/storage/safe'
import { createLocalTripStore, createPrefsStore, createSaveStatus } from '@/storage/stores'

import App from './App'

const storage = createSafeStorage()
const status = createSaveStatus(storage.available ? 'local' : 'failed')
const today = todayLocal()
const stores: Stores = {
  storage,
  status,
  today,
  trip: createLocalTripStore(storage, () => today, status),
  prefs: createPrefsStore(storage, status),
}
// 2 novas tentativas para a cotação; nos testes, o QueryClient não tenta de novo.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2 } } })

pingHealth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <StoresProvider value={stores}>
        <App />
      </StoresProvider>
    </QueryClientProvider>
  </StrictMode>,
)
