/** Chamadas à API (mesma origem: o Worker repassa /api para o backend). */
import type { components } from './api-schema'

export type RatesData = components['schemas']['RatesOut']
export type AirportData = components['schemas']['AirportOut']

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, path: string) {
    super(`A API respondeu ${status} em ${path}`)
    this.status = status
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new ApiError(response.status, path)
  return (await response.json()) as T
}

export function fetchLatestRates(signal?: AbortSignal): Promise<RatesData> {
  return getJson<RatesData>('/api/rates/latest', signal)
}

export function searchAirports(q: string, signal?: AbortSignal, limit = 8): Promise<AirportData[]> {
  const query = new URLSearchParams({ q, limit: String(limit) })
  return getJson<AirportData[]>(`/api/airports/search?${query}`, signal)
}

export async function getAirport(iata: string, signal?: AbortSignal): Promise<AirportData | null> {
  try {
    return await getJson<AirportData>(`/api/airports/${encodeURIComponent(iata)}`, signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Acorda a API (o Render gratuito dorme) sem esperar a resposta: quando a pessoa buscar, ela já está de pé. */
export function pingHealth(): void {
  fetch('/api/health').catch(() => undefined)
}
