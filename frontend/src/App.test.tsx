import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/render'

describe('App', () => {
  it('mostra o nome do app, o seletor de tema e as fontes dos dados no rodapé', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'GoodPlan' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tema' })).toHaveValue('system')
    expect(screen.getByRole('link', { name: 'Frankfurter' })).toHaveAttribute('href', 'https://frankfurter.dev')
    expect(screen.getByRole('link', { name: 'OurAirports' })).toHaveAttribute('href', 'https://ourairports.com/data/')
    expect(screen.getByRole('link', { name: 'Unicode CLDR' })).toHaveAttribute('href', 'https://cldr.unicode.org')
    expect(screen.getByText('Valores de referência. Confira as taxas com o seu banco ou cartão.')).toBeInTheDocument()
  })
})
