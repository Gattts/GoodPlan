/** Busca de aeroportos enquanto a pessoa digita: espera uma pausa, cancela a busca velha e avisa a demora. */
import { useEffect, useState } from 'react'

import { searchAirports, type AirportData } from '@/lib/api'

export type SearchStatus = 'idle' | 'loading' | 'slow' | 'done' | 'empty' | 'error'
export type SearchResult = { status: SearchStatus; results: AirportData[] }

export const SEARCH_DEBOUNCE_MS = 250
/** Passou disso, a API provavelmente estava dormindo (Render gratuito) e está acordando. */
export const SLOW_AFTER_MS = 3000
export const MIN_QUERY = 2

const IDLE: SearchResult = { status: 'idle', results: [] }
const WAITING: SearchResult = { status: 'loading', results: [] }

export function useAirportSearch(query: string): SearchResult {
  const term = query.trim()
  const [state, setState] = useState<SearchResult & { term: string }>({ term: '', ...IDLE })

  useEffect(() => {
    if (term.length < MIN_QUERY) return
    const controller = new AbortController()
    let slowTimer: ReturnType<typeof setTimeout> | undefined
    const debounce = setTimeout(() => {
      setState({ term, status: 'loading', results: [] })
      slowTimer = setTimeout(() => {
        setState((current) =>
          current.term === term && current.status === 'loading' ? { ...current, status: 'slow' } : current,
        )
      }, SLOW_AFTER_MS)
      searchAirports(term, controller.signal).then(
        (results) => {
          clearTimeout(slowTimer)
          setState({ term, status: results.length ? 'done' : 'empty', results })
        },
        () => {
          clearTimeout(slowTimer)
          if (!controller.signal.aborted) setState({ term, status: 'error', results: [] })
        },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(debounce)
      clearTimeout(slowTimer)
      controller.abort()
    }
  }, [term])

  if (term.length < MIN_QUERY) return IDLE
  if (state.term !== term) return WAITING
  return { status: state.status, results: state.results }
}
