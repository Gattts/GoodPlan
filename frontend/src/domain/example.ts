import { addDays } from './dates'
import type { Trip } from './types'

const EXAMPLE_LEAD_DAYS = 60
const EXAMPLE_LENGTH_DAYS = 10

/** Viagem de exemplo da primeira visita: completa sem depender da API (nomes já preenchidos). */
export function exampleTrip(today: string): Trip {
  const departDate = addDays(today, EXAMPLE_LEAD_DAYS)
  return {
    origin: { iata: 'GRU', city: 'São Paulo', countryCode: 'BR', countryName: 'Brasil', currency: 'BRL' },
    destination: { iata: 'LIS', city: 'Lisboa', countryCode: 'PT', countryName: 'Portugal', currency: 'EUR' },
    departDate,
    returnDate: addDays(departDate, EXAMPLE_LENGTH_DAYS),
    people: 2,
    currency: 'EUR',
    dailySpend: 80,
    isExample: true,
  }
}

export function emptyTrip(): Trip {
  return {
    origin: null,
    destination: null,
    departDate: null,
    returnDate: null,
    people: 1,
    currency: 'EUR',
    dailySpend: null,
    isExample: false,
  }
}
