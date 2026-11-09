/** Contas da viagem e do câmbio. Toda conversão passa pelo real: valor × (R$ da origem) ÷ (R$ do destino). */
import { diffDays } from './dates'
import type { DaysResult, FeeLine } from './types'

const STALE_AFTER_DAYS = 7

/** Dias da estadia: volta − ida, como no protótipo; ida e volta no mesmo dia contam 1. */
export function tripDays(depart: string | null, ret: string | null): DaysResult {
  if (!depart || !ret) return { kind: 'missing' }
  const days = diffDays(depart, ret)
  if (days < 0) return { kind: 'invalid' }
  return { kind: 'ok', days: Math.max(1, days) }
}

/** Reais por unidade: o real vale 1; a cotação própria da pessoa vale mais que a de referência. */
export function brlPerUnit(
  currency: string,
  rates: Record<string, number>,
  custom: Record<string, number>,
): number | null {
  if (currency === 'BRL') return 1
  return custom[currency] ?? rates[currency] ?? null
}

export function feeFactor(iof: number, spread: number): number {
  return 1 + (iof + spread) / 100
}

type StayInput = {
  dailySpend: number | null
  days: number | null
  people: number
  currency: string
  brlPerUnit: number | null
  feeFactor: number
}

/** Custo da estadia em reais; IOF e spread só entram quando a moeda local não é o real. */
export function stayCost({ dailySpend, days, people, currency, brlPerUnit, feeFactor }: StayInput): number | null {
  if (dailySpend === null || days === null || brlPerUnit === null) return null
  return dailySpend * days * people * brlPerUnit * (currency === 'BRL' ? 1 : feeFactor)
}

export function convert(amount: number, fromBrlPerUnit: number | null, toBrlPerUnit: number | null): number | null {
  if (fromBrlPerUnit === null || toBrlPerUnit === null) return null
  return (amount * fromBrlPerUnit) / toBrlPerUnit
}

/** O que a pessoa paga de fato: comprar moeda estrangeira custa mais; vender rende menos. */
export function feeLine(from: string, to: string, result: number | null, factor: number): FeeLine {
  if (result === null) return null
  if (from === to) return { kind: 'same' }
  if (to === 'BRL') return { kind: 'to-brl', value: result * factor }
  if (from === 'BRL') return { kind: 'from-brl', value: result / factor }
  return { kind: 'foreign' }
}

/** Valores da tabela pelo tamanho da moeda: euro em dezenas, peso uruguaio em centenas, iene em milhares. */
export function commonValues(brlPerUnit: number): number[] {
  if (brlPerUnit >= 0.5) return [10, 50, 100, 500]
  if (brlPerUnit >= 0.05) return [100, 500, 1000, 5000]
  return [1000, 5000, 10000, 50000]
}

export function isStale(rateDate: string, today: string): boolean {
  return diffDays(rateDate, today) > STALE_AFTER_DAYS
}

const THOUSANDS_ONLY = /^-?\d{1,3}(\.\d{3})+$/
const AMERICAN_FORMAT = /^-?\d{1,3}(,\d{3})+\.\d*$/
const BRAZILIAN_FORMAT = /^-?(\d{1,3}(\.\d{3})+|\d*)(,\d*)?$/
const PLAIN_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

/**
 * Número como o brasileiro digita: "80,50" e "1.234,56" com vírgula decimal; "1.234" sem vírgula é milhar; "1.5" é
 * decimal. Com ponto e vírgula juntos, o último é o decimal ("1,234.56" também vale 1234,56), desde que os milhares
 * tenham grupos de 3 dígitos. Separador no começo ou no fim é aceito ("80," no meio da digitação). Texto vazio ou
 * inválido devolve null.
 */
export function parseDecimal(text: string): number | null {
  const value = text.trim()
  if (!value) return null
  let normalized = value
  if (AMERICAN_FORMAT.test(value)) normalized = value.replaceAll(',', '')
  else if (value.includes(',')) {
    if (!BRAZILIAN_FORMAT.test(value)) return null
    normalized = value.replaceAll('.', '').replace(',', '.')
  } else if (THOUSANDS_ONLY.test(value)) normalized = value.replaceAll('.', '')
  return PLAIN_NUMBER.test(normalized) ? Number(normalized) : null
}
