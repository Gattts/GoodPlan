import { afterEach, describe, expect, it, vi } from 'vitest'

import { stubFetch } from '@/test/fetch'
import { RATES } from '@/test/fixtures'

import { ApiError, fetchLatestRates, getAirport, pingHealth, searchAirports } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cliente da API', () => {
  it('busca as cotações e os aeroportos nos caminhos certos', async () => {
    const fetchMock = stubFetch({
      '/api/rates/latest': RATES,
      '/api/airports/search?q=t%C3%B3quio&limit=8': [],
    })
    await expect(fetchLatestRates()).resolves.toEqual(RATES)
    await expect(searchAirports('tóquio')).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aeroporto inexistente vira null e erro do servidor vira ApiError com o status', async () => {
    stubFetch({ '/api/airports/XXX': { status: 404 }, '/api/rates/latest': { status: 503 } })
    await expect(getAirport('XXX')).resolves.toBeNull()
    const error = await fetchLatestRates().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
  })

  it('pingHealth não lança erro mesmo sem rede', async () => {
    const fake = vi.fn(() => Promise.reject(new TypeError('offline')))
    vi.stubGlobal('fetch', fake)
    expect(() => pingHealth()).not.toThrow()
    expect(fake).toHaveBeenCalledWith('/api/health')
    await Promise.resolve() // a rejeição é tratada sem quebrar o teste
  })
})
