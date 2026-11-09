import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { normalizeCode } from '@/domain/airports'
import { AIRPORTS, RATES } from '@/test/fixtures'
import { renderApp } from '@/test/render'

const MUNIQUE = { iata: 'MUC', city: 'Munique', countryCode: 'DE', countryName: 'Alemanha', currency: 'EUR' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('busca de aeroporto', () => {
  it('normaliza o código digitado', () => {
    expect([' lis', 'GRU ', 'gr', 'gru1', 'São'].map(normalizeCode)).toEqual(['LIS', 'GRU', null, null, null])
  })

  it('escolher Narita como destino troca a moeda local', async () => {
    const user = userEvent.setup()
    renderApp({
      today: '2026-11-05',
      rates: RATES,
      routes: { '/api/airports/search?q=t%C3%B3quio&limit=8': [AIRPORTS.HND, AIRPORTS.NRT] },
    })
    await user.click(screen.getByRole('button', { name: 'Destino: LIS' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), 'tóquio')
    expect(await screen.findByRole('option', { name: /HND · Tóquio, Japão/ })).toBeVisible()
    expect(screen.getByRole('option', { name: /NRT · Tóquio, Japão/ })).toBeVisible()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByText('São Paulo para Tóquio, Japão')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Destino: NRT' })).toBeVisible()
    expect(screen.getByLabelText('Moeda local')).toHaveValue('JPY')
  })

  it('código digitado com espaço e minúsculas vira LIS', async () => {
    // foco da revisão 5
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      today: '2026-11-05',
      rates: RATES,
      preset: { destination: MUNIQUE },
      routes: { '/api/airports/LIS': AIRPORTS.LIS },
    })
    await user.click(screen.getByRole('button', { name: 'Destino: MUC' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), ' lis{Enter}')
    expect(screen.getByRole('button', { name: 'Destino: LIS' })).toBeVisible()
    expect(await screen.findByText('São Paulo para Lisboa, Portugal')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/api/airports/LIS', expect.anything())
  })

  it('código inexistente fica no cartão com aviso', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES, routes: { '/api/airports/XYZ': { status: 404 } } })
    await user.click(screen.getByRole('button', { name: 'Destino: LIS' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), 'xyz{Enter}')
    expect(screen.getByRole('button', { name: 'Destino: XYZ' })).toBeVisible()
    expect(await screen.findByText(/Aeroporto não encontrado/)).toBeVisible()
  })

  it('sem resultado, avisa', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES, routes: { '/api/airports/search?q=zzzz&limit=8': [] } })
    await user.click(screen.getByRole('button', { name: 'Origem: GRU' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de origem' }), 'zzzz')
    expect(await screen.findByText('Nenhum aeroporto encontrado')).toBeVisible()
  })

  it('busca que falha avisa e sugere digitar o código', async () => {
    const user = userEvent.setup()
    renderApp({
      today: '2026-11-05',
      rates: RATES,
      routes: { '/api/airports/search?q=lisboa&limit=8': { status: 503 } },
    })
    await user.click(screen.getByRole('button', { name: 'Destino: LIS' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), 'lisboa')
    expect(await screen.findByText('Busca indisponível agora. Digite o código de 3 letras.')).toBeVisible()
  })

  it('busca que demora mais de 3 s avisa que o servidor está acordando', async () => {
    vi.useFakeTimers()
    try {
      renderApp({
        today: '2026-11-05',
        rates: RATES,
        routes: { '/api/airports/search?q=lisboa&limit=8': () => new Promise<Response>(() => undefined) },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Destino: LIS' }))
      fireEvent.change(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), {
        target: { value: 'lisboa' },
      })
      await act(() => vi.advanceTimersByTimeAsync(250 + 3000))
      expect(screen.getByText('Acordando o servidor, pode levar até 1 minuto')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Enter com a API fora do ar mantém o código, sem dizer que ele não existe', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      today: '2026-11-05',
      rates: RATES,
      routes: { '/api/airports/XYZ': () => Promise.reject(new TypeError('sem rede')) },
    })
    await user.click(screen.getByRole('button', { name: 'Destino: LIS' }))
    await user.type(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }), 'xyz{Enter}')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/airports/XYZ', expect.anything()))
    expect(screen.getByRole('button', { name: 'Destino: XYZ' })).toBeVisible()
    expect(screen.queryByText(/Aeroporto não encontrado/)).not.toBeInTheDocument()
  })

  it('Esc fecha a busca e devolve o foco ao botão', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    const trigger = screen.getByRole('button', { name: 'Destino: LIS' })
    await user.click(trigger)
    expect(screen.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Aeroporto ou cidade de destino' })).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })
})
