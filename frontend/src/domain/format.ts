import type { Trip } from './types'

const MRZ_LENGTH = 44

/** Dinheiro em pt-BR com as casas decimais da própria moeda (o iene, por exemplo, sem centavos). */
export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

export function formatDateBR(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function formatDayMonth(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

const segment = (text: string | null | undefined, size: number) =>
  (text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(size, '<')
    .slice(0, size)

const yymmdd = (iso: string) => iso.slice(2).replaceAll('-', '')

/** Linha no estilo da zona legível por máquina do passaporte (só enfeite, como no protótipo). */
export function mrzLine(trip: Trip, days: number | null): string {
  const depart = trip.departDate ? yymmdd(trip.departDate) : '<<<<<<'
  const ret = trip.returnDate ? yymmdd(trip.returnDate) : '<<<<<<'
  const line =
    `${segment(trip.origin?.iata, 3)}<${segment(trip.destination?.iata, 3)}<<${depart}<${ret}` +
    `<<${trip.people}PAX<<${segment(trip.currency, 3)}<<${days ?? '<'}D`
  return line.padEnd(MRZ_LENGTH, '<').slice(0, MRZ_LENGTH)
}
