import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RATES } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { plain } from '@/test/text'

const total = () => plain(screen.getByTestId('stub-total').textContent)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('canhoto', () => {
  it('primeira visita: total da estadia da viagem de exemplo', async () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    await waitFor(() => expect(total()).toBe('R$ 10.178,24'))
    expect(screen.getByText('Estadia · 10 dias')).toBeVisible()
    expect(screen.getByText('Inclui IOF e spread nos valores em moeda estrangeira.')).toBeVisible()
  })

  it('editar tira a marca de exemplo e recalcula', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    await waitFor(() => expect(total()).toBe('R$ 10.178,24'))
    await user.selectOptions(screen.getByLabelText('Pessoas'), '3')
    expect(total()).toBe('R$ 15.267,36')
    expect(screen.queryByText('Viagem de exemplo. Edite qualquer campo.')).not.toBeInTheDocument()
  })

  it('gasto digitado com vírgula vale', async () => {
    // foco da revisão 1
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    await waitFor(() => expect(total()).toBe('R$ 10.178,24'))
    const spend = screen.getByLabelText('Gasto/dia por pessoa (EUR)')
    await user.clear(spend)
    await user.type(spend, '80,50')
    expect(total()).toBe('R$ 10.241,85')
  })

  it('API fora do ar e nada guardado: para de dizer que está buscando', async () => {
    renderApp({ today: '2026-11-05', routes: { '/api/rates/latest': { status: 503 } } })
    expect(
      await screen.findByText('Não consegui buscar a cotação. Informe a sua cotação na calculadora.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Buscando a cotação…')).not.toBeInTheDocument()
  })

  it('moeda sem cotação pede a cotação própria', async () => {
    renderApp({
      today: '2026-11-05',
      rates: RATES,
      preset: {
        destination: {
          iata: 'PTY',
          city: 'Cidade do Panamá',
          countryCode: 'PA',
          countryName: 'Panamá',
          currency: 'PAB',
        },
        currency: 'PAB',
      },
    })
    expect(await screen.findByText('Sem cotação para PAB. Informe a sua cotação na calculadora.')).toBeInTheDocument()
    expect(total()).toBe('R$ —')
  })

  it('viagem dentro do Brasil não tem IOF', () => {
    renderApp({
      today: '2026-11-05',
      preset: {
        destination: { iata: 'SSA', city: 'Salvador', countryCode: 'BR', countryName: 'Brasil', currency: 'BRL' },
        currency: 'BRL',
        dailySpend: 200,
        people: 1,
        departDate: '2027-01-04',
        returnDate: '2027-01-07',
      },
    })
    expect(total()).toBe('R$ 600,00')
    expect(screen.getByText('Estadia · 3 dias')).toBeVisible()
  })
})
