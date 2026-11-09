import { expect, test } from '@playwright/test'

// Dia fixo: a cotação dos dados de teste é de 05/11/2026, e o exemplo é calculado a partir de "hoje".
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00-03:00'))
})

const result = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Câmbio' }).getByRole('status')

test('primeira visita: exemplo e estadia sem esperar nada', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Viagem de exemplo. Edite qualquer campo.')).toBeVisible()
  await expect(page.getByText('São Paulo para Lisboa, Portugal')).toBeVisible()
  await expect(page.getByTestId('stub-total')).toHaveText(/R\$\s10\.178,24/)
})

test('editar a viagem recalcula e sobrevive ao recarregar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stub-total')).toHaveText(/R\$\s10\.178,24/)
  await page.getByLabel('Pessoas', { exact: true }).selectOption('3')
  await expect(page.getByTestId('stub-total')).toHaveText(/R\$\s15\.267,36/)
  await page.waitForFunction(() => localStorage.getItem('goodplan:trip')?.includes('"people":3'))
  await page.reload()
  await expect(page.getByLabel('Pessoas', { exact: true })).toHaveValue('3')
  await expect(page.getByTestId('stub-total')).toHaveText(/R\$\s15\.267,36/)
})

test('buscar "tóquio" e escolher Narita', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Destino: LIS' }).click()
  await page.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }).fill('tóquio')
  await page.getByRole('option', { name: /NRT · Tóquio, Japão/ }).click()
  await expect(page.getByText('São Paulo para Tóquio, Japão')).toBeVisible()
  await expect(page.getByLabel('Moeda local')).toHaveValue('JPY')
})

test('calculadora: converter, inverter e cotação própria', async ({ page }) => {
  await page.goto('/')
  const calculator = page.getByRole('region', { name: 'Câmbio' })
  await expect(result(page)).toHaveText(/R\$\s614,63/)
  await expect(calculator.getByText(/^Com IOF e spread/)).toHaveText(/R\$\s636,14/)
  await calculator.getByRole('button', { name: 'Inverter moedas' }).click()
  await expect(result(page)).toHaveText(/€\s16,27/)
  await calculator.getByRole('button', { name: 'Inverter moedas' }).click()
  await calculator.getByLabel('1 EUR em reais').fill('6,5')
  await expect(calculator.getByText('Sua cotação')).toBeVisible()
  await expect(result(page)).toHaveText(/R\$\s650,00/)
})

test('API fora do ar: a cotação guardada continua', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Cotação de 05/11')).toBeVisible()
  await page.waitForFunction(() => localStorage.getItem('goodplan:rates') !== null)
  await page.route('**/api/**', (route) => route.abort())
  await page.reload()
  await expect(result(page)).toHaveText(/R\$\s614,63/)
  await expect(page.getByTestId('stub-total')).toHaveText(/R\$\s10\.178,24/)
})
