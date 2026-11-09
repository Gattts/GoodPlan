export type Theme = 'system' | 'light' | 'dark'

/** Automático segue o sistema (sem atributo); Claro e Escuro fixam o tema no <html>. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
}
