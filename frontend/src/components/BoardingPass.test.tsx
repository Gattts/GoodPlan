import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RATES } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { plain } from '@/test/text'

const total = () => plain(screen.getByTestId('stub-total').textContent)
const LISBOA = { iata: 'LIS', city: 'Lisboa', countryCode: 'PT', countryName: 'Portugal', currency: 'EUR' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cartão de embarque', () => {
  it('primeira visita: exemplo completo com a rota', () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    expect(screen.getByText('Viagem de exemplo. Edite qualquer campo.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Origem: GRU' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Destino: LIS' })).toBeVisible()
    expect(screen.getByText('São Paulo para Lisboa, Portugal')).toBeVisible()
    expect(screen.getByLabelText('Ida')).toHaveValue('2027-01-04')
    expect(screen.getByLabelText('Volta')).toHaveValue('2027-01-14')
    expect(screen.getByLabelText('Pessoas')).toHaveValue('2')
    expect(screen.getByLabelText('Moeda local')).toHaveValue('EUR')
    expect(screen.getByLabelText('Gasto/dia por pessoa (EUR)')).toHaveValue('80')
  })

  it('volta antes da ida: mensagem ligada ao campo e estadia vazia', async () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    await waitFor(() => expect(total()).toBe('R$ 10.178,24'))
    const volta = screen.getByLabelText('Volta')
    fireEvent.change(volta, { target: { value: '2027-01-01' } })
    expect(volta).toHaveAccessibleDescription('A volta está antes da ida.')
    expect(total()).toBe('R$ —')
  })

  it('só com a ida, pede a volta', () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    fireEvent.change(screen.getByLabelText('Volta'), { target: { value: '' } })
    expect(screen.getByText('Preencha a volta para calcular a estadia.')).toBeVisible()
  })

  it('ida no passado é aceita, com aviso', () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    const ida = screen.getByLabelText('Ida')
    fireEvent.change(ida, { target: { value: '2026-10-01' } })
    expect(ida).toHaveAccessibleDescription('A ida já passou.')
  })

  it('origem igual ao destino tem aviso', () => {
    renderApp({ today: '2026-11-05', rates: RATES, preset: { origin: LISBOA, destination: LISBOA } })
    expect(screen.getByText('Origem e destino iguais.')).toBeVisible()
  })

  it('Começar do zero esvazia a viagem', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    await user.click(screen.getByRole('button', { name: 'Começar do zero' }))
    expect(screen.getByRole('button', { name: 'Origem: escolher aeroporto' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Destino: escolher aeroporto' })).toBeVisible()
    expect(total()).toBe('R$ —')
    expect(screen.queryByText('Viagem de exemplo. Edite qualquer campo.')).not.toBeInTheDocument()
  })

  it('pessoas fora de 1 a 9 e gasto negativo são recusados com mensagem', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    await waitFor(() => expect(total()).toBe('R$ 10.178,24'))
    const pessoas = within(screen.getByLabelText('Pessoas')).getAllByRole('option')
    expect(pessoas.map((option) => option.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    const gasto = screen.getByLabelText('Gasto/dia por pessoa (EUR)')
    await user.clear(gasto)
    await user.type(gasto, '-5')
    expect(gasto).toHaveAccessibleDescription('O gasto precisa ser zero ou mais.')
  })

  it('viagem vazia não mostra códigos que parecem de verdade', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-05', rates: RATES })
    await user.click(screen.getByRole('button', { name: 'Começar do zero' }))
    expect(screen.getByRole('button', { name: 'Origem: escolher aeroporto' })).toHaveTextContent('---')
    expect(screen.getByRole('button', { name: 'Destino: escolher aeroporto' })).toHaveTextContent('---')
  })

  it('a linha no estilo de passaporte é só enfeite', () => {
    renderApp({ today: '2026-11-05', rates: RATES })
    expect(screen.getByText('GRU<LIS<<270104<270114<<2PAX<<EUR<<10D<<<<<<')).toHaveAttribute('aria-hidden', 'true')
  })
})
