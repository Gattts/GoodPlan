import type { Theme } from '@/theme'

/** Aeroporto escolhido na viagem. Só `iata` quando o código foi digitado e não achamos o aeroporto. */
export type AirportRef = {
  iata: string
  city?: string
  countryCode?: string
  countryName?: string
  currency?: string
  /** O código foi digitado e a API respondeu que ele não existe. */
  notFound?: boolean
}

export type Trip = {
  origin: AirportRef | null
  destination: AirportRef | null
  departDate: string | null // AAAA-MM-DD
  returnDate: string | null // AAAA-MM-DD
  people: number
  currency: string
  dailySpend: number | null // por pessoa, na moeda local
  isExample: boolean
}

export type Prefs = {
  calc: { amount: string; from: string | null; to: string }
  fees: { iof: number; spread: number }
  customRates: Record<string, number> // reais por unidade, digitados pela pessoa
  theme: Theme
}

export type DaysResult = { kind: 'ok'; days: number } | { kind: 'invalid' } | { kind: 'missing' }

export type FeeLine = { kind: 'to-brl' | 'from-brl'; value: number } | { kind: 'foreign' } | { kind: 'same' } | null
