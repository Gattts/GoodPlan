import type { AirportData, RatesData } from '@/lib/api'

const airport = (iata: string, name: string, city: string, country: [string, string], currency: string) =>
  ({
    iata,
    name,
    city,
    country_code: country[0],
    country_name: country[1],
    currency,
    kind: 'large_airport',
  }) satisfies AirportData

/** Aeroportos no formato de /api/airports (mesmos dados do backend de teste). */
export const AIRPORTS = {
  HND: airport('HND', 'Tokyo Haneda International Airport', 'Tóquio', ['JP', 'Japão'], 'JPY'),
  NRT: airport('NRT', 'Narita International Airport', 'Tóquio', ['JP', 'Japão'], 'JPY'),
  LIS: airport('LIS', 'Lisbon Humberto Delgado Airport', 'Lisboa', ['PT', 'Portugal'], 'EUR'),
}

/** Cotações de 05/11/2026 no formato de /api/rates/latest (mesmos números do backend de teste). */
export const RATES: RatesData = {
  base: 'BRL',
  source: { name: 'Frankfurter', url: 'https://frankfurter.dev' },
  latest_date: '2026-11-05',
  fetched_at: '2026-11-05T20:00:07Z',
  rates: [
    { currency: 'EUR', name: 'Euro', brl_per_unit: 6.14628, date: '2026-11-05' },
    { currency: 'JPY', name: 'Iene japonês', brl_per_unit: 0.0345209, date: '2026-11-05' },
    { currency: 'USD', name: 'Dólar americano', brl_per_unit: 5.46508, date: '2026-11-05' },
    { currency: 'UYU', name: 'Peso uruguaio', brl_per_unit: 0.135875, date: '2026-11-05' },
  ],
}
