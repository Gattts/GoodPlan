import { describe, expect, it } from 'vitest'

import { plain } from '@/test/text'

import { exampleTrip } from './example'
import { formatDateBR, formatDayMonth, formatMoney, mrzLine } from './format'

describe('formatação', () => {
  it('formata dinheiro em pt-BR com as casas de cada moeda', () => {
    expect(plain(formatMoney(10178.23968, 'BRL'))).toBe('R$ 10.178,24')
    expect(plain(formatMoney(162.70004, 'EUR'))).toBe('€ 162,70')
    expect(plain(formatMoney(1234.5, 'JPY'))).toMatch(/1\.235$/)
  })

  it('formata datas', () => {
    expect(formatDateBR('2026-11-05')).toBe('05/11/2026')
    expect(formatDayMonth('2026-11-05')).toBe('05/11')
  })

  it('monta a linha no estilo de passaporte com 44 caracteres', () => {
    const trip = exampleTrip('2026-11-05')
    expect(mrzLine(trip, 10)).toBe('GRU<LIS<<270104<270114<<2PAX<<EUR<<10D<<<<<<')
    expect(mrzLine({ ...trip, origin: null, departDate: null }, null)).toBe(
      '<<<<LIS' + '<'.repeat(9) + '270114<<2PAX<<EUR<<<D' + '<'.repeat(7),
    )
  })
})
