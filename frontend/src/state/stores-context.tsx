/** Acesso dos componentes à viagem, às preferências e à situação do armazenamento. */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

import { emptyTrip } from '@/domain/example'
import type { Prefs, Trip } from '@/domain/types'
import type { SafeStorage } from '@/storage/safe'
import type { PrefsStore, SaveStatus, SaveStatusStore, TripStore } from '@/storage/stores'

export type Stores = {
  trip: TripStore
  prefs: PrefsStore
  status: SaveStatusStore
  storage: SafeStorage
  /** Dia local de quando o app abriu (AAAA-MM-DD). */
  today: string
}

const StoresContext = createContext<Stores | null>(null)

export function StoresProvider({ value, children }: { value: Stores; children: ReactNode }) {
  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
}

export function useStores(): Stores {
  const stores = useContext(StoresContext)
  if (!stores) throw new Error('StoresProvider ausente')
  return stores
}

export function useTrip() {
  const { trip: store } = useStores()
  const trip = useSyncExternalStore(store.subscribe, store.load)
  return {
    trip,
    /** Qualquer edição tira a marca de exemplo: a viagem passa a ser da pessoa. */
    update: (patch: Partial<Trip>) => store.save({ ...store.load(), ...patch, isExample: false }),
    reset: () => store.save(emptyTrip()),
  }
}

export function usePrefs() {
  const { prefs: store } = useStores()
  const prefs = useSyncExternalStore(store.subscribe, store.load)
  return { prefs, update: (patch: Partial<Prefs>) => store.save({ ...store.load(), ...patch }) }
}

export function useSaveStatus(): SaveStatus {
  const { status } = useStores()
  return useSyncExternalStore(status.subscribe, status.get)
}

export function useToday(): string {
  return useStores().today
}
