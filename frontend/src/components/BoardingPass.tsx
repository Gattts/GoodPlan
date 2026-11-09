import { useId, type ReactNode } from 'react'

import { tripDays } from '@/domain/calc'
import { mrzLine } from '@/domain/format'
import type { AirportRef, Trip } from '@/domain/types'
import { useRates } from '@/hooks/useRates'
import { useToday, useTrip } from '@/state/stores-context'

import { AirportPicker } from './AirportPicker'
import { DecimalField } from './DecimalField'
import { Stub } from './Stub'

const LABEL = 'text-[11px] font-bold tracking-[0.07em] text-sign-soft uppercase'
const INPUT =
  'w-full min-w-0 rounded-none border-0 border-b-[1.5px] border-sign-line bg-transparent px-0 py-[3px] font-data text-[15.5px] font-medium tabular-nums text-sign-ink hover:border-sign-ink'
const MESSAGE = 'mt-1 text-[12.5px] leading-tight font-semibold text-sign-ink'

const PEOPLE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const placeName = (airport: AirportRef | null) => (airport ? (airport.city ?? airport.iata) : '?')

function routeText(trip: Trip): string {
  if (!trip.origin && !trip.destination) return 'Escolha a origem e o destino'
  const country = trip.destination?.countryName ? `, ${trip.destination.countryName}` : ''
  const route = `${placeName(trip.origin)} para ${placeName(trip.destination)}${country}`
  return trip.origin?.notFound || trip.destination?.notFound ? `${route} · Aeroporto não encontrado` : route
}

function currencyOptions(trip: Trip, rates: Record<string, number>): string[] {
  const codes = new Set(['BRL', ...Object.keys(rates), trip.currency])
  if (trip.destination?.currency) codes.add(trip.destination.currency)
  return [...codes].sort()
}

export function BoardingPass() {
  const { trip, update, reset } = useTrip()
  const today = useToday()
  const { rates } = useRates()
  const days = tripDays(trip.departDate, trip.returnDate)
  const departWarning = trip.departDate && trip.departDate < today ? 'A ida já passou.' : null
  const returnError = days.kind === 'invalid' ? 'A volta está antes da ida.' : null
  const sameAirport = trip.origin && trip.destination && trip.origin.iata === trip.destination.iata

  return (
    <section
      aria-label="Viagem atual"
      className="@container min-w-0 rounded-xl bg-sign text-sign-ink [color-scheme:light] [&_:focus-visible]:outline-sign-ink"
    >
      <div className="grid @min-[760px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-2.5 px-4 pt-4 pb-3.5 @min-[760px]:px-[22px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11.5px] font-bold tracking-[0.09em] uppercase">
            <span>Cartão de embarque</span>
            {trip.isExample ? (
              <>
                <span className="rounded-[3px] border border-sign-ink px-1.5 py-px text-[12.5px] font-semibold tracking-[0.02em] normal-case">
                  Viagem de exemplo. Edite qualquer campo.
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-[3px] px-1.5 py-px text-[12.5px] font-semibold tracking-[0.02em] normal-case underline underline-offset-2"
                >
                  Começar do zero
                </button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-[clamp(6px,1.6cqw,16px)]">
            <AirportPicker label="Origem" value={trip.origin} onSelect={(origin) => update({ origin })} />
            <span className="flex min-w-6 flex-1 items-center gap-2" aria-hidden="true">
              <span className="flex-1 border-t-2 border-dashed border-sign-line" />
              <svg viewBox="0 0 24 24" className="size-[clamp(22px,4cqw,38px)] flex-none fill-current">
                <path d="M2 11h7L5 3h3l6 8h5c2 0 3 .5 3 1s-1 1-3 1h-5l-6 8H5l4-8H2z" />
              </svg>
              <span className="flex-1 border-t-2 border-dashed border-sign-line" />
            </span>
            <AirportPicker
              label="Destino"
              value={trip.destination}
              // O destino escolhido troca a moeda local para a do país (dá para mudar depois).
              onSelect={(destination) =>
                update(destination.currency ? { destination, currency: destination.currency } : { destination })
              }
            />
          </div>

          <p className="min-h-[1.4em] text-[15px] font-semibold">{routeText(trip)}</p>
          {sameAirport ? <p className={MESSAGE}>Origem e destino iguais.</p> : null}

          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2.5 @min-[560px]:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]">
            <DateField
              label="Ida"
              value={trip.departDate}
              message={departWarning}
              onChange={(departDate) => update({ departDate })}
            />
            <DateField
              label="Volta"
              value={trip.returnDate}
              message={returnError}
              onChange={(returnDate) => update({ returnDate })}
            />
            <SelectField
              label="Pessoas"
              value={String(trip.people)}
              options={PEOPLE_OPTIONS}
              onChange={(people) => update({ people: Number(people) })}
            />
            <SelectField
              label="Moeda local"
              value={trip.currency}
              options={currencyOptions(trip, rates)}
              onChange={(currency) => update({ currency })}
            />
            <DecimalField
              label={`Gasto/dia por pessoa (${trip.currency})`}
              value={trip.dailySpend}
              placeholder="0"
              onChange={(dailySpend) => update({ dailySpend })}
              validate={(spend) => (spend >= 0 ? null : 'O gasto precisa ser zero ou mais.')}
              className="col-span-full grid min-w-0 gap-0.5 @min-[560px]:col-span-1"
              labelClassName={LABEL}
              inputClassName={INPUT}
              errorClassName={MESSAGE}
            />
          </div>

          <p
            aria-hidden="true"
            className="font-data text-[clamp(10px,1.6cqw,13.5px)] leading-tight tracking-[0.07em] break-all text-sign-soft"
          >
            {mrzLine(trip, days.kind === 'ok' ? days.days : null)}
          </p>
        </div>
        <Stub />
      </div>
    </section>
  )
}

function DateField(props: {
  label: string
  value: string | null
  message: string | null
  onChange: (value: string | null) => void
}) {
  const id = useId()
  return (
    <Field label={props.label} htmlFor={id} message={props.message} messageId={`${id}-aviso`}>
      <input
        id={id}
        type="date"
        value={props.value ?? ''}
        aria-describedby={props.message ? `${id}-aviso` : undefined}
        className={INPUT}
        onChange={(event) => props.onChange(event.target.value || null)}
      />
    </Field>
  )
}

function SelectField(props: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <Field label={props.label} htmlFor={id}>
      <select id={id} value={props.value} className={INPUT} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </Field>
  )
}

function Field(props: {
  label: string
  htmlFor: string
  message?: string | null
  messageId?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <label htmlFor={props.htmlFor} className={LABEL}>
        {props.label}
      </label>
      {props.children}
      {props.message ? (
        <p id={props.messageId} className={MESSAGE}>
          {props.message}
        </p>
      ) : null}
    </div>
  )
}
