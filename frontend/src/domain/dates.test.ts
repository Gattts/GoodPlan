import { describe, expect, it } from 'vitest'

import { addDays, diffDays, todayLocal } from './dates'

describe('datas', () => {
  it('usa o dia local, não o UTC', () => {
    // foco da revisão 2: 23h30 em São Paulo já é 02h30 do dia seguinte em UTC
    expect(todayLocal(new Date('2026-11-05T23:30:00-03:00'))).toBe('2026-11-05')
  })

  it('soma e subtrai dias no calendário', () => {
    expect(addDays('2026-11-05', 60)).toBe('2027-01-04')
    expect(addDays('2027-01-04', 10)).toBe('2027-01-14')
    expect(diffDays('2026-12-10', '2026-12-20')).toBe(10)
    expect(diffDays('2026-12-20', '2026-12-10')).toBe(-10)
  })
})
