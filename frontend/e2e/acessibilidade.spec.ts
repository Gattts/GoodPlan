import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00-03:00'))
})

async function openReady(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Câmbio' }).getByRole('status')).toHaveText(/R\$\s614,63/)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`sem violações do axe no tema ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await openReady(page)
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(violations).toEqual([])
  })
}

test('busca aberta também passa no axe', async ({ page }) => {
  await openReady(page)
  await page.getByRole('button', { name: 'Destino: LIS' }).click()
  await page.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }).fill('tóquio')
  await expect(page.getByRole('option', { name: /NRT · Tóquio, Japão/ })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(violations).toEqual([])
})

test('viagem vazia e mensagens de erro passam no axe', async ({ page }) => {
  await openReady(page)
  await page.getByRole('button', { name: 'Começar do zero' }).click()
  await expect(page.getByRole('button', { name: 'Origem: escolher aeroporto' })).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([])

  await page.getByLabel('Ida', { exact: true }).fill('2027-01-10')
  await page.getByLabel('Volta', { exact: true }).fill('2027-01-01')
  await page.getByLabel(/^Gasto\/dia/).fill('-5')
  await expect(page.getByText('A volta está antes da ida.')).toBeVisible()
  await expect(page.getByText('O gasto precisa ser zero ou mais.')).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([])
})

test('a CSP de produção está ativa e não bloqueia nada do app', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { cspViolations: string[] }).cspViolations = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'")
  await expect(page.getByRole('region', { name: 'Câmbio' }).getByRole('status')).toHaveText(/R\$\s614,63/)
  await page.getByRole('button', { name: 'Destino: LIS' }).click()
  await page.getByRole('combobox', { name: 'Aeroporto ou cidade de destino' }).fill('tóquio')
  await expect(page.getByRole('option', { name: /NRT · Tóquio, Japão/ })).toBeVisible()
  const violations = await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)
  expect(violations).toEqual([])
})

test('sem rolagem horizontal, inclusive em 320 px', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 })
    await openReady(page)
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(fits).toBe(true)
  }
})
