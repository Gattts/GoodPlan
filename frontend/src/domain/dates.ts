/** Datas de calendário no formato AAAA-MM-DD, sem fuso: "dia 10" é dia 10 em qualquer lugar. */

const DAY_MS = 86_400_000
const pad = (value: number) => String(value).padStart(2, '0')

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** Hoje no fuso de quem usa: às 23h30 em São Paulo ainda é hoje, mesmo que em UTC já seja amanhã. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const date = new Date(toUtcMs(iso) + days * DAY_MS)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}
