import type { Theme } from '@/theme'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

type ThemeSelectProps = { value: Theme; onChange: (theme: Theme) => void }

export function ThemeSelect({ value, onChange }: ThemeSelectProps) {
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
      Tema
      <select
        className="min-h-8 rounded-[5px] border border-line bg-field px-2 py-1 text-[13px] font-medium text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value as Theme)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
