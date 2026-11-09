import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { searchAirports } from '@/lib/api'
import { AIRPORTS } from '@/test/fixtures'

import { useAirportSearch } from './useAirportSearch'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  searchAirports: vi.fn(),
}))

const search = vi.mocked(searchAirports)
const pending = () => new Promise<never>(() => undefined)
// Os timers falsos disparam atualizações de estado: dentro de act, o React as aplica antes da próxima verificação.
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
  search.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAirportSearch', () => {
  it('espera 250 ms e 2 caracteres antes de buscar, e cancela a busca anterior', async () => {
    search.mockImplementation(pending)
    const { result, rerender } = renderHook(({ q }) => useAirportSearch(q), { initialProps: { q: 't' } })
    await wait(300)
    expect(search).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')

    rerender({ q: 'tó' })
    await wait(249)
    expect(search).not.toHaveBeenCalled()
    await wait(1)
    expect(search).toHaveBeenCalledWith('tó', expect.any(AbortSignal))

    const firstSignal = search.mock.calls[0][1] as AbortSignal
    rerender({ q: 'tóq' })
    expect(firstSignal.aborted).toBe(true)
  })

  it('passou de 3 s: avisa que o servidor está acordando', async () => {
    search.mockImplementation(pending)
    const { result } = renderHook(() => useAirportSearch('tóquio'))
    await wait(250)
    expect(result.current.status).toBe('loading')
    await wait(3000)
    expect(result.current.status).toBe('slow')
  })

  it('devolve os resultados, ou diz que não achou, ou que deu erro', async () => {
    search.mockResolvedValueOnce([AIRPORTS.HND, AIRPORTS.NRT])
    const found = renderHook(() => useAirportSearch('tóquio'))
    await wait(250)
    expect(found.result.current).toEqual({ status: 'done', results: [AIRPORTS.HND, AIRPORTS.NRT] })

    search.mockResolvedValueOnce([])
    const empty = renderHook(() => useAirportSearch('zzzz'))
    await wait(250)
    expect(empty.result.current.status).toBe('empty')

    search.mockRejectedValueOnce(new TypeError('sem rede'))
    const failed = renderHook(() => useAirportSearch('lisboa'))
    await wait(250)
    expect(failed.result.current.status).toBe('error')
  })
})
