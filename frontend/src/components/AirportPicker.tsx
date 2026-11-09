import { Popover } from 'radix-ui'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import { normalizeCode, toAirportRef } from '@/domain/airports'
import type { AirportRef } from '@/domain/types'
import { useAirportSearch, type SearchStatus } from '@/hooks/useAirportSearch'
import { getAirport, type AirportData } from '@/lib/api'

const MESSAGES: Partial<Record<SearchStatus, string>> = {
  idle: 'Digite a cidade, o país ou o código (ex.: lisboa, GRU).',
  loading: 'Buscando…',
  slow: 'Acordando o servidor, pode levar até 1 minuto',
  empty: 'Nenhum aeroporto encontrado',
  error: 'Busca indisponível agora. Digite o código de 3 letras.',
}

type AirportPickerProps = {
  label: 'Origem' | 'Destino'
  value: AirportRef | null
  onSelect: (airport: AirportRef) => void
}

/** Código grande do cartão que abre a busca (combobox acessível: setas, Enter e Esc). */
export function AirportPicker({ label, value, onSelect }: AirportPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIata, setActiveIata] = useState<string | null>(null)
  const { status, results } = useAirportSearch(open ? query : '')
  const lastChoice = useRef(0)
  const inputId = useId()
  const listId = useId()
  const role = label.toLowerCase()
  const activeIndex = Math.max(
    0,
    results.findIndex((airport) => airport.iata === activeIata),
  )

  const close = () => {
    setOpen(false)
    setQuery('')
    setActiveIata(null)
  }

  const choose = (airport: AirportData) => {
    lastChoice.current += 1
    onSelect(toAirportRef(airport))
    close()
  }

  // Código digitado direto: vale na hora; os nomes chegam quando a API responder.
  const chooseCode = (code: string) => {
    const choice = ++lastChoice.current
    onSelect({ iata: code })
    close()
    getAirport(code).then(
      (found) => {
        if (choice !== lastChoice.current) return // a pessoa já escolheu outro
        onSelect(found ? toAirportRef(found) : { iata: code, notFound: true })
      },
      () => undefined, // API fora do ar: o código fica sem os nomes
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!results.length) return
      const next = event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1
      setActiveIata(results[Math.min(Math.max(next, 0), results.length - 1)].iata)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (status === 'done' && results[activeIndex]) choose(results[activeIndex])
      else {
        const code = normalizeCode(query)
        if (code) chooseCode(code)
      }
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value?.iata ?? 'escolher aeroporto'}`}
          className="flex-none border-b-[3px] border-transparent font-display text-[clamp(44px,14cqw,104px)] leading-[0.98] font-black tracking-[0.01em] uppercase hover:border-sign-line"
        >
          {value ? value.iata : <span className="text-sign-soft">---</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={`Buscar aeroporto de ${role}`}
          className="z-20 grid w-[min(calc(100vw-32px),380px)] gap-2 rounded-md border border-line bg-surface p-3 text-ink shadow-lg"
        >
          <label htmlFor={inputId} className="text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase">
            Aeroporto ou cidade de {role}
          </label>
          <input
            id={inputId}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            placeholder="lisboa, tóquio ou GRU"
            className="min-h-10 w-full rounded-[5px] border border-line bg-field px-2.5 py-1.5 text-[15px] text-ink"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <p role="status" className="min-h-[1.2em] text-[13px] text-muted">
            {status === 'done' ? '' : MESSAGES[status]}
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label={`Aeroportos de ${role}`}
            className="grid max-h-72 overflow-y-auto empty:hidden"
          >
            {results.map((airport, index) => (
              <li
                key={airport.iata}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className="cursor-pointer rounded-[4px] px-2 py-1.5 aria-selected:bg-sign aria-selected:text-sign-ink"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIata(airport.iata)}
                onClick={() => choose(airport)}
              >
                <span className="font-data font-medium">{airport.iata}</span> · {airport.city},{' '}
                {airport.country_name ?? airport.country_code}
                <span className="block text-[12.5px] opacity-75">{airport.name}</span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
