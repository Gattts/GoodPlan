import type { AirportData } from '@/lib/api'

import type { AirportRef } from './types'

/** Três letras de A a Z, sem espaços nas pontas e em maiúsculas (" lis" vira "LIS"); o resto não é código. */
export function normalizeCode(text: string): string | null {
  const code = text.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

export function toAirportRef(airport: AirportData): AirportRef {
  return {
    iata: airport.iata,
    city: airport.city,
    countryCode: airport.country_code,
    countryName: airport.country_name ?? undefined,
    currency: airport.currency ?? undefined,
  }
}
