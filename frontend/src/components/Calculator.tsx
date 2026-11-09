import { useId } from 'react'

import { brlPerUnit, commonValues, convert, feeFactor, feeLine, isStale, parseDecimal } from '@/domain/calc'
import { formatDateBR, formatDayMonth, formatMoney } from '@/domain/format'
import type { FeeLine } from '@/domain/types'
import { useRates } from '@/hooks/useRates'
import { usePrefs, useToday, useTrip } from '@/state/stores-context'

import { DecimalField } from './DecimalField'

const fourPlaces = (value: number) => Math.round(value * 10_000) / 10_000
const LABEL = 'text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase'
const CONTROL = 'min-h-10 w-full min-w-0 rounded-[5px] border border-line bg-field px-2.5 py-1.5 text-[15px] text-ink'
const MESSAGE = 'mt-1 text-[12.5px] leading-tight font-semibold text-bad'
const PILL = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  idle: 'bg-idle-bg text-idle',
}

function feeText(line: FeeLine, to: string): string {
  if (line === null) return ''
  if (line.kind === 'same') return 'Mesma moeda.'
  if (line.kind === 'foreign') return 'Conversão entre moedas estrangeiras, sem IOF.'
  return `Com IOF e spread: ${formatMoney(line.value, line.kind === 'to-brl' ? 'BRL' : to)}`
}

const inRange = (value: number) => (value >= 0 && value <= 100 ? null : 'Use um valor de 0 a 100.')

export function Calculator() {
  const { prefs, update } = usePrefs()
  const { trip } = useTrip()
  const today = useToday()
  const { data, rates, dates, names, isFetching } = useRates()
  const amountId = useId()
  const fromId = useId()
  const toId = useId()

  const from = prefs.calc.from ?? trip.currency
  const to = prefs.calc.to
  // A moeda estrangeira do par: é dela a cotação editável, a tabela e o selo.
  const foreign = from !== 'BRL' ? from : to !== 'BRL' ? to : null
  const custom = foreign ? prefs.customRates[foreign] : undefined
  const factor = feeFactor(prefs.fees.iof, prefs.fees.spread)
  const amount = parseDecimal(prefs.calc.amount)
  const converted =
    amount === null || amount < 0
      ? null
      : convert(amount, brlPerUnit(from, rates, prefs.customRates), brlPerUnit(to, rates, prefs.customRates))
  const foreignUnit = foreign ? brlPerUnit(foreign, rates, prefs.customRates) : null
  const rateDate = foreign ? (dates[foreign] ?? null) : (data?.latest_date ?? null)
  const currencies = [...new Set(['BRL', ...Object.keys(rates), from, to, trip.currency])].sort()
  const currencyName = (code: string) => (code === 'BRL' ? 'Real brasileiro' : (names[code] ?? code))

  const setCalc = (patch: Partial<typeof prefs.calc>) => update({ calc: { ...prefs.calc, ...patch } })
  const setCustomRate = (code: string, value: number | undefined) => {
    const next = { ...prefs.customRates }
    if (value === undefined) delete next[code]
    else next[code] = value
    update({ customRates: next })
  }

  let pill: { text: string; tone: keyof typeof PILL } | null = null
  if (custom !== undefined) pill = { text: 'Sua cotação', tone: 'idle' }
  else if (foreign && data && foreignUnit === null) pill = { text: 'Sem cotação', tone: 'warn' }
  else if (rateDate && isStale(rateDate, today)) pill = { text: 'Cotação antiga', tone: 'warn' }
  else if (rateDate) pill = { text: `Cotação de ${formatDayMonth(rateDate)}`, tone: 'ok' }

  return (
    <section
      aria-labelledby={`${amountId}-titulo`}
      className="grid gap-2.5 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2.5">
        <h2 id={`${amountId}-titulo`} className="font-display text-[30px] leading-none font-extrabold">
          Câmbio
        </h2>
        {pill ? (
          <span className={`rounded-[3px] px-[7px] text-[12px] leading-normal font-semibold ${PILL[pill.tone]}`}>
            {pill.text}
          </span>
        ) : null}
      </div>

      <div className="grid gap-0.5">
        <label htmlFor={amountId} className={LABEL}>
          Valor
        </label>
        <input
          id={amountId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={prefs.calc.amount}
          className={`${CONTROL} font-data text-[24px] tabular-nums`}
          onChange={(event) => setCalc({ amount: event.target.value.slice(0, 32) })}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-end gap-1.5">
        <div className="grid gap-0.5">
          <label htmlFor={fromId} className={LABEL}>
            De
          </label>
          <select
            id={fromId}
            value={from}
            className={CONTROL}
            onChange={(event) => setCalc({ from: event.target.value })}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code} · {currencyName(code)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          aria-label="Inverter moedas"
          className="grid size-10 place-items-center rounded-[5px] border border-line bg-field text-ink hover:border-ink"
          onClick={() => setCalc({ from: to, to: from })}
        >
          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />
          </svg>
        </button>
        <div className="grid gap-0.5">
          <label htmlFor={toId} className={LABEL}>
            Para
          </label>
          <select id={toId} value={to} className={CONTROL} onChange={(event) => setCalc({ to: event.target.value })}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code} · {currencyName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-[5px] bg-sign px-3 py-2.5 text-sign-ink">
        <output
          htmlFor={`${amountId} ${fromId} ${toId}`}
          className="block font-display text-[34px] leading-[1.05] font-black tabular-nums [overflow-wrap:anywhere]"
        >
          {converted === null ? '—' : formatMoney(converted, to)}
        </output>
        <span className="text-[13.5px] font-medium">{feeText(feeLine(from, to, converted, factor), to)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DecimalField
          label="IOF %"
          value={prefs.fees.iof}
          onChange={(iof) => {
            if (iof !== null) update({ fees: { ...prefs.fees, iof } })
          }}
          validate={inRange}
          className="grid min-w-0 gap-0.5"
          labelClassName={LABEL}
          inputClassName={CONTROL}
          errorClassName={MESSAGE}
        />
        <DecimalField
          label="Spread %"
          value={prefs.fees.spread}
          onChange={(spread) => {
            if (spread !== null) update({ fees: { ...prefs.fees, spread } })
          }}
          validate={inRange}
          className="grid min-w-0 gap-0.5"
          labelClassName={LABEL}
          inputClassName={CONTROL}
          errorClassName={MESSAGE}
        />
      </div>

      {foreign ? (
        <>
          <DecimalField
            label={`1 ${foreign} em reais`}
            value={foreignUnit === null ? null : fourPlaces(foreignUnit)}
            placeholder="Digite a cotação"
            onChange={(value) => {
              if (value !== null) setCustomRate(foreign, value)
            }}
            onRevert={(value) => {
              // Voltar ao número arredondado que o campo mostrava para a referência não é cotação própria.
              const isReference =
                value === null || (rates[foreign] !== undefined && value === fourPlaces(rates[foreign]))
              setCustomRate(foreign, isReference ? undefined : value)
            }}
            validate={(value) => (value > 0 ? null : 'A cotação precisa ser maior que zero.')}
            className="grid min-w-0 gap-0.5"
            labelClassName={LABEL}
            inputClassName={`${CONTROL} font-data tabular-nums`}
            errorClassName={MESSAGE}
          />
          {custom !== undefined ? (
            <button
              type="button"
              className="min-h-8 justify-self-start rounded-[5px] border border-line bg-surface px-2.5 py-1 text-[13px] font-semibold hover:border-ink"
              onClick={() => setCustomRate(foreign, undefined)}
            >
              Voltar à cotação de referência
            </button>
          ) : null}
          {foreignUnit !== null ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-data text-[13px] tabular-nums">
                <thead>
                  <tr>
                    {['Valor', 'Em reais', 'Com taxas'].map((title, index) => (
                      <th
                        key={title}
                        scope="col"
                        className={`py-1 pl-2 font-body text-[11.5px] font-semibold tracking-[0.05em] text-muted uppercase ${index === 0 ? 'pl-0 text-left' : 'text-right'}`}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commonValues(foreignUnit).map((value) => (
                    <tr key={value} className="border-t border-line">
                      <td className="py-1 text-left">{value.toLocaleString('pt-BR')}</td>
                      <td className="py-1 pl-2 text-right">{formatMoney(value * foreignUnit, 'BRL')}</td>
                      <td className="py-1 pl-2 text-right">{formatMoney(value * foreignUnit * factor, 'BRL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      {isFetching ? <p className="text-[12.5px] text-muted">Atualizando cotação…</p> : null}
      {rateDate ? (
        <p className="text-[12.5px] leading-snug text-muted">
          Referência: Frankfurter (combinação de bancos centrais), {formatDateBR(rateDate)}.
        </p>
      ) : null}
      <p className="text-[12.5px] leading-snug text-muted">
        IOF de 3,5% para cartão e dinheiro em espécie (Decreto nº 12.499/2025), conferido em 05/11/2026.
      </p>
    </section>
  )
}
