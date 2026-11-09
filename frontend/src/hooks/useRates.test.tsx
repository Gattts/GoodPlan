import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadRatesCache, saveRatesCache } from '@/storage/stores'
import { stubFetch } from '@/test/fetch'
import { RATES } from '@/test/fixtures'
import { createTestStores, TestProviders } from '@/test/render'
import { memoryStorage } from '@/test/storage'

import { useRates } from './useRates'

const OLD_RATES = { ...RATES, rates: RATES.rates.map((r) => (r.currency === 'EUR' ? { ...r, brl_per_unit: 6 } : r)) }

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup() {
  const storage = memoryStorage()
  saveRatesCache(storage, OLD_RATES, new Date('2026-11-04T10:00:00Z')) // guardada há mais de 1 hora
  const stores = createTestStores({ storage })
  const { result } = renderHook(() => useRates(), {
    wrapper: ({ children }) => <TestProviders stores={stores}>{children}</TestProviders>,
  })
  return { storage, result }
}

describe('useRates', () => {
  it('mostra a cotação guardada na hora e troca pela nova quando chega', async () => {
    stubFetch({ '/api/rates/latest': RATES })
    const { storage, result } = setup()
    expect(result.current.rates.EUR).toBe(6)
    await waitFor(() => expect(result.current.rates.EUR).toBe(6.14628))
    expect(result.current.dates.EUR).toBe('2026-11-05')
    expect(result.current.names.UYU).toBe('Peso uruguaio')
    expect(loadRatesCache(storage)?.data).toEqual(RATES)
  })

  it('erro da API mantém a cotação guardada', async () => {
    const fetchMock = stubFetch({ '/api/rates/latest': { status: 503 } })
    const { storage, result } = setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.rates.EUR).toBe(6)
    expect(loadRatesCache(storage)?.data).toEqual(OLD_RATES)
  })
})
