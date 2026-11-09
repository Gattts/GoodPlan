import { describe, expect, it } from 'vitest'

import { emptyTrip, exampleTrip } from './example'

describe('viagens prontas', () => {
  it('viagem de exemplo daqui a 60 dias, por 10 dias', () => {
    expect(exampleTrip('2026-11-05')).toEqual({
      origin: { iata: 'GRU', city: 'São Paulo', countryCode: 'BR', countryName: 'Brasil', currency: 'BRL' },
      destination: { iata: 'LIS', city: 'Lisboa', countryCode: 'PT', countryName: 'Portugal', currency: 'EUR' },
      departDate: '2027-01-04',
      returnDate: '2027-01-14',
      people: 2,
      currency: 'EUR',
      dailySpend: 80,
      isExample: true,
    })
  })

  it('viagem vazia para começar do zero', () => {
    expect(emptyTrip()).toEqual({
      origin: null,
      destination: null,
      departDate: null,
      returnDate: null,
      people: 1,
      currency: 'EUR',
      dailySpend: null,
      isExample: false,
    })
  })
})
