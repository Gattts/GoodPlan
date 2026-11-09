import { describe, expect, it } from 'vitest'

import {
  brlPerUnit,
  commonValues,
  convert,
  feeFactor,
  feeLine,
  isStale,
  parseDecimal,
  stayCost,
  tripDays,
} from './calc'

describe('cálculos', () => {
  it('conta os dias da viagem', () => {
    expect(tripDays('2026-12-10', '2026-12-20')).toEqual({ kind: 'ok', days: 10 })
    expect(tripDays('2026-12-10', '2026-12-10')).toEqual({ kind: 'ok', days: 1 })
    expect(tripDays('2026-12-10', '2026-12-09')).toEqual({ kind: 'invalid' })
    expect(tripDays('2026-12-10', null)).toEqual({ kind: 'missing' })
    expect(tripDays(null, '2026-12-10')).toEqual({ kind: 'missing' })
  })

  it('usa a cotação própria antes da de referência', () => {
    const rates = { EUR: 6.14628 }
    expect(brlPerUnit('BRL', rates, {})).toBe(1)
    expect(brlPerUnit('EUR', rates, { EUR: 6.5 })).toBe(6.5)
    expect(brlPerUnit('EUR', rates, {})).toBe(6.14628)
    expect(brlPerUnit('PAB', rates, {})).toBeNull()
  })

  it('calcula a estadia com IOF e spread só em moeda estrangeira', () => {
    const factor = feeFactor(3.5, 0)
    expect(factor).toBeCloseTo(1.035)
    expect(
      stayCost({ dailySpend: 80, days: 10, people: 2, currency: 'EUR', brlPerUnit: 6.14628, feeFactor: factor }),
    ).toBeCloseTo(10178.23968, 4)
    expect(stayCost({ dailySpend: 200, days: 3, people: 1, currency: 'BRL', brlPerUnit: 1, feeFactor: factor })).toBe(
      600,
    )
    expect(
      stayCost({ dailySpend: null, days: 10, people: 2, currency: 'EUR', brlPerUnit: 6.14628, feeFactor: factor }),
    ).toBeNull()
    expect(
      stayCost({ dailySpend: 80, days: 10, people: 2, currency: 'PAB', brlPerUnit: null, feeFactor: factor }),
    ).toBeNull()
    expect(
      stayCost({ dailySpend: 80, days: null, people: 2, currency: 'EUR', brlPerUnit: 6.14628, feeFactor: factor }),
    ).toBeNull()
  })

  it('converte passando pelo real e descreve as taxas', () => {
    expect(convert(100, 6.14628, 1)).toBeCloseTo(614.628)
    expect(convert(1000, 1, 6.14628)).toBeCloseTo(162.70004, 4)
    expect(convert(100, null, 1)).toBeNull()
    expect(feeLine('EUR', 'BRL', 614.628, 1.035)).toEqual({ kind: 'to-brl', value: expect.closeTo(636.13998, 4) })
    expect(feeLine('BRL', 'EUR', 162.70004, 1.035)).toEqual({ kind: 'from-brl', value: expect.closeTo(157.19811, 4) })
    expect(feeLine('EUR', 'UYU', 4523.48, 1.035)).toEqual({ kind: 'foreign' })
    expect(feeLine('EUR', 'EUR', 100, 1.035)).toEqual({ kind: 'same' })
    expect(feeLine('EUR', 'BRL', null, 1.035)).toBeNull()
  })

  it('escolhe os valores comuns pelo tamanho da moeda e marca cotação antiga', () => {
    expect(commonValues(6.14628)).toEqual([10, 50, 100, 500])
    expect(commonValues(0.5)).toEqual([10, 50, 100, 500])
    expect(commonValues(0.135875)).toEqual([100, 500, 1000, 5000])
    expect(commonValues(0.05)).toEqual([100, 500, 1000, 5000])
    expect(commonValues(0.0345)).toEqual([1000, 5000, 10000, 50000])
    expect(isStale('2026-10-29', '2026-11-05')).toBe(false)
    expect(isStale('2026-10-28', '2026-11-05')).toBe(true)
  })

  it('entende números com vírgula, como o brasileiro digita', () => {
    // foco da revisão 1
    expect(['80,50', '1.234,56', '1.234', '1.5', ' 100 ', '-3'].map(parseDecimal)).toEqual([
      80.5, 1234.56, 1234, 1.5, 100, -3,
    ])
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })

  it('com ponto e vírgula juntos, o último separador é o decimal', () => {
    expect(['1,234.56', '12,345.6', '1,234,567.89', '1.234.567,89'].map(parseDecimal)).toEqual([
      1234.56, 12345.6, 1234567.89, 1234567.89,
    ])
    expect(parseDecimal('1.2,3.4')).toBeNull()
  })

  it.each(['1,5.', '1.5,', '12,5.0', '1,2.3', '1,23.45', '1.23,45', '1.234.5,6'])(
    'recusa grupos de dígitos errados em vez de inventar um valor (%s)',
    (text) => {
      expect(parseDecimal(text)).toBeNull()
    },
  )

  it('aceita separador no começo e no fim, enquanto a pessoa digita', () => {
    expect(['80,', ',5', '80.', '.5'].map(parseDecimal)).toEqual([80, 0.5, 80, 0.5])
    expect(parseDecimal(',')).toBeNull()
    expect(parseDecimal('.')).toBeNull()
  })
})
