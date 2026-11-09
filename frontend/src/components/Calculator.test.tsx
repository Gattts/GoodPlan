import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { saveRatesCache } from '@/storage/stores'
import { RATES } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { memoryStorage } from '@/test/storage'
import { plain } from '@/test/text'

const calculator = () => within(screen.getByRole('region', { name: 'Câmbio' }))
const result = () => plain(calculator().getByRole('status').textContent)
const ready = () => waitFor(() => expect(result()).toBe('R$ 614,63'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calculadora de câmbio', () => {
  it('começa da moeda da viagem para o real, com a linha de taxas', async () => {
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    expect(calculator().getByLabelText('Valor')).toHaveValue('100')
    expect(calculator().getByLabelText('De')).toHaveValue('EUR')
    expect(calculator().getByLabelText('Para')).toHaveValue('BRL')
    expect(plain(calculator().getByText(/^Com IOF e spread/).textContent)).toBe('Com IOF e spread: R$ 636,14')
  })

  it('inverter troca as moedas', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    await user.click(calculator().getByRole('button', { name: 'Inverter moedas' }))
    expect(result()).toBe('€ 16,27')
    expect(plain(calculator().getByText(/^Com IOF e spread/).textContent)).toBe('Com IOF e spread: € 15,72')
  })

  it('entre moedas estrangeiras não há IOF', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    await user.selectOptions(calculator().getByLabelText('Para'), 'UYU')
    expect(calculator().getByText('Conversão entre moedas estrangeiras, sem IOF.')).toBeVisible()
  })

  it('valor vazio ou negativo mostra —', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const valor = calculator().getByLabelText('Valor')
    await user.clear(valor)
    expect(result()).toBe('—')
    await user.type(valor, '-5')
    expect(result()).toBe('—')
  })

  it('spread muda a calculadora e o canhoto', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const spread = calculator().getByLabelText('Spread %')
    await user.clear(spread)
    await user.type(spread, '1,5')
    expect(plain(calculator().getByText(/^Com IOF e spread/).textContent)).toBe('Com IOF e spread: R$ 645,36')
    expect(plain(screen.getByTestId('stub-total').textContent)).toBe('R$ 10.325,75')
  })

  it('IOF fora de 0 a 100 é recusado', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const iof = calculator().getByLabelText('IOF %')
    await user.clear(iof)
    await user.type(iof, '150')
    expect(iof).toHaveAccessibleDescription('Use um valor de 0 a 100.')
    await user.tab()
    expect(iof).toHaveValue('3,5')
    expect(plain(calculator().getByText(/^Com IOF e spread/).textContent)).toBe('Com IOF e spread: R$ 636,14')
  })

  it('cotação recusada não vira "Sua cotação" ao sair do campo', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const rate = calculator().getByLabelText('1 EUR em reais')
    await user.clear(rate)
    await user.type(rate, '6-') // o "6" do caminho é válido; o "6-" não
    await user.tab()
    expect(rate).toHaveValue('6,1463')
    expect(calculator().queryByText('Sua cotação')).not.toBeInTheDocument()
    expect(result()).toBe('R$ 614,63')
  })

  it('sem cotação de referência, texto recusado não deixa cotação própria para trás', async () => {
    const user = userEvent.setup()
    renderApp({
      today: '2026-11-06',
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
    const rate = await calculator().findByLabelText('1 PAB em reais')
    await user.type(rate, '6-') // o "6" do caminho é válido; o "6-" não
    await user.tab()
    expect(rate).toHaveValue('')
    expect(calculator().queryByText('Sua cotação')).not.toBeInTheDocument()
    expect(calculator().getByText('Sem cotação')).toBeVisible()
  })

  it('cotação digitada que coincide com a de referência arredondada vale como própria', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const rate = calculator().getByLabelText('1 EUR em reais')
    await user.clear(rate)
    await user.type(rate, '6,1463')
    expect(calculator().getByText('Sua cotação')).toBeVisible()
  })

  it('moeda sem cotação não mostra selo verde nem referência', async () => {
    renderApp({
      today: '2026-11-06',
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
    expect(await calculator().findByText('Sem cotação')).toBeVisible()
    expect(calculator().queryByText(/^Cotação de/)).not.toBeInTheDocument()
    expect(calculator().queryByText(/^Referência:/)).not.toBeInTheDocument()
    expect(calculator().getByLabelText('1 PAB em reais')).toHaveAttribute('placeholder', 'Digite a cotação')
  })

  it('cotação própria vira "Sua cotação" e volta à de referência', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const rate = calculator().getByLabelText('1 EUR em reais')
    expect(rate).toHaveValue('6,1463')
    await user.clear(rate)
    await user.type(rate, '6,5')
    expect(calculator().getByText('Sua cotação')).toBeVisible()
    expect(result()).toBe('R$ 650,00')
    await user.click(calculator().getByRole('button', { name: 'Voltar à cotação de referência' }))
    expect(result()).toBe('R$ 614,63')
    expect(calculator().getByLabelText('1 EUR em reais')).toHaveValue('6,1463')
  })

  it('cotação própria menor ou igual a zero é recusada', async () => {
    const user = userEvent.setup()
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const rate = calculator().getByLabelText('1 EUR em reais')
    await user.clear(rate)
    await user.type(rate, '0')
    expect(rate).toHaveAccessibleDescription('A cotação precisa ser maior que zero.')
  })

  it('tabela de valores comuns pelo tamanho da moeda', async () => {
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    const row = calculator().getByRole('row', { name: /^10 / })
    const cells = within(row)
      .getAllByRole('cell')
      .map((cell) => plain(cell.textContent))
    expect(cells).toEqual(['10', 'R$ 61,46', 'R$ 63,61'])
    expect(calculator().getAllByRole('row')).toHaveLength(5) // cabeçalho + 10, 50, 100 e 500
  })

  it('selo com a data da cotação e cotação antiga depois de 7 dias', async () => {
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    expect(calculator().getByText('Cotação de 05/11')).toBeVisible()
  })

  it('cotação com mais de 7 dias ganha o selo de antiga', async () => {
    renderApp({ today: '2026-11-13', rates: RATES })
    await ready()
    expect(calculator().getByText('Cotação antiga')).toBeVisible()
  })

  it('cita as fontes da cotação e do IOF', async () => {
    renderApp({ today: '2026-11-06', rates: RATES })
    await ready()
    expect(calculator().getByText('Referência: Frankfurter (combinação de bancos centrais), 05/11/2026.')).toBeVisible()
    expect(calculator().getByText(/Decreto nº 12\.499\/2025/)).toBeVisible()
    expect(calculator().queryByRole('link')).not.toBeInTheDocument() // o endereço oficial ainda não foi conferido
  })

  it('com a consulta pendente, mostra "Atualizando cotação…" sem bloquear', () => {
    const storage = memoryStorage()
    saveRatesCache(storage, RATES, new Date('2026-11-05T10:00:00Z')) // guardada há mais de 1 hora
    renderApp({ storage, today: '2026-11-06' }) // sem `rates`: a API não responde
    expect(calculator().getByText('Atualizando cotação…')).toBeVisible()
    expect(result()).toBe('R$ 614,63')
  })
})
