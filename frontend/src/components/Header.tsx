import type { ReactNode } from 'react'

import type { Theme } from '@/theme'

import { ThemeSelect } from './ThemeSelect'

type HeaderProps = { saveStatus?: ReactNode; theme: Theme; onThemeChange: (theme: Theme) => void }

export function Header({ saveStatus, theme, onThemeChange }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h1 className="font-display text-[26px] leading-none font-extrabold tracking-[0.01em]">GoodPlan</h1>
      <div className="flex flex-wrap items-center gap-3">
        {saveStatus ? <span className="font-data text-[12.5px] text-muted">{saveStatus}</span> : null}
        <ThemeSelect value={theme} onChange={onThemeChange} />
      </div>
    </header>
  )
}
