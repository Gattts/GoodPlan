import { useLayoutEffect, useRef } from 'react'

import { brlPerUnit, feeFactor, stayCost, tripDays } from '@/domain/calc'
import { formatMoney } from '@/domain/format'
import type { Trip } from '@/domain/types'
import { useRates } from '@/hooks/useRates'
import { usePrefs, useTrip } from '@/state/stores-context'

function noteFor(
  trip: Trip,
  days: ReturnType<typeof tripDays>,
  hasRate: boolean,
  ratesLoaded: boolean,
  ratesFailed: boolean,
) {
  if (days.kind === 'invalid') return 'Corrija as datas para calcular a estadia.'
  if (!trip.departDate && !trip.returnDate) return 'Preencha a ida e a volta para calcular a estadia.'
  if (!trip.returnDate) return 'Preencha a volta para calcular a estadia.'
  if (!trip.departDate) return 'Preencha a ida para calcular a estadia.'
  if (trip.dailySpend === null) return 'Preencha o gasto por dia para calcular a estadia.'
  if (!hasRate && ratesFailed) return 'Não consegui buscar a cotação. Informe a sua cotação na calculadora.'
  if (!hasRate && !ratesLoaded) return 'Buscando a cotação…'
  if (!hasRate) return `Sem cotação para ${trip.currency}. Informe a sua cotação na calculadora.`
  return 'Inclui IOF e spread nos valores em moeda estrangeira.'
}

/** Parte destacável do cartão: o custo da estadia em reais. A linha de passagens entra na parte de voos. */
export function Stub() {
  const { trip } = useTrip()
  const { prefs } = usePrefs()
  const { data, rates, isError } = useRates()
  const days = tripDays(trip.departDate, trip.returnDate)
  const unit = brlPerUnit(trip.currency, rates, prefs.customRates)
  const cost = stayCost({
    dailySpend: trip.dailySpend,
    days: days.kind === 'ok' ? days.days : null,
    people: trip.people,
    currency: trip.currency,
    brlPerUnit: unit,
    feeFactor: feeFactor(prefs.fees.iof, prefs.fees.spread),
  })
  const totalText = cost === null ? 'R$ —' : formatMoney(cost, 'BRL')
  const totalRef = useFitText(totalText)

  return (
    <div className="relative grid min-w-0 content-start gap-1.5 border-t-2 border-dashed border-sign-line px-4 py-4 @min-[760px]:border-t-0 @min-[760px]:border-l-2 @min-[760px]:px-[22px]">
      <span className="text-[11.5px] font-bold tracking-[0.09em] uppercase">Custo estimado</span>
      <div
        ref={totalRef}
        data-testid="stub-total"
        aria-live="polite"
        className="overflow-hidden font-display text-[clamp(38px,5vw,50px)] leading-[1.05] font-black whitespace-nowrap tabular-nums"
      >
        {totalText}
      </div>
      <div className="flex justify-between gap-3 border-t border-sign-line pt-1.5 text-[14px]">
        <span>{days.kind === 'ok' ? `Estadia · ${days.days} ${days.days === 1 ? 'dia' : 'dias'}` : 'Estadia'}</span>
        <b className="font-data text-[13.5px] font-medium whitespace-nowrap tabular-nums">
          {cost === null ? '—' : formatMoney(cost, 'BRL')}
        </b>
      </div>
      <p className="text-[13px] leading-[1.35] text-sign-soft">
        {noteFor(trip, days, unit !== null, data !== null, isError)}
      </p>
    </div>
  )
}

/** Diminui a fonte do total quando ele não cabe na largura (como o fitTotal do protótipo). */
function useFitText(text: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.fontSize = ''
    if (element.scrollWidth > element.clientWidth && element.clientWidth > 0) {
      const size = parseFloat(getComputedStyle(element).fontSize)
      element.style.fontSize = `${Math.floor((size * element.clientWidth) / element.scrollWidth)}px`
    }
  }, [text])
  return ref
}
