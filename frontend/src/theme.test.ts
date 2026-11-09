import { describe, expect, it } from 'vitest'

import { applyTheme } from './theme'

describe('applyTheme', () => {
  it('Automático remove o atributo; Claro e Escuro fixam o tema', () => {
    const root = document.createElement('html')
    applyTheme('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyTheme('light', root)
    expect(root.dataset.theme).toBe('light')
    applyTheme('system', root)
    expect(root.hasAttribute('data-theme')).toBe(false)
  })
})
