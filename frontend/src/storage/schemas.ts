/** Formatos guardados no navegador, com versão: dado de outra versão ou corrompido é ignorado. */
import { z } from 'zod'

// A CSP do site proíbe eval; sem isto, o zod tenta `new Function` para acelerar e gera uma violação a cada carga.
z.config({ jitless: true })

const currencyCode = z.string().regex(/^[A-Z]{3}$/)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const airportRef = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  currency: currencyCode.optional(),
  notFound: z.boolean().optional(),
})

export const tripSchema = z.object({
  origin: airportRef.nullable(),
  destination: airportRef.nullable(),
  departDate: isoDate.nullable(),
  returnDate: isoDate.nullable(),
  people: z.number().int().min(1).max(9),
  currency: currencyCode,
  dailySpend: z.number().min(0).nullable(),
  isExample: z.boolean(),
})

export const prefsSchema = z.object({
  calc: z.object({ amount: z.string().max(32), from: currencyCode.nullable(), to: currencyCode }),
  fees: z.object({ iof: z.number().min(0).max(100), spread: z.number().min(0).max(100) }),
  customRates: z.record(currencyCode, z.number().positive()),
  theme: z.enum(['system', 'light', 'dark']),
})

/** Mesmo formato de GET /api/rates/latest (o tipo vem do OpenAPI, em @/lib/api). */
export const ratesDataSchema = z.object({
  base: z.literal('BRL'),
  source: z.object({ name: z.string(), url: z.string() }),
  latest_date: isoDate.nullable(),
  fetched_at: z.string().nullable(),
  rates: z.array(
    z.object({ currency: currencyCode, name: z.string(), brl_per_unit: z.number().positive(), date: isoDate }),
  ),
})

export const tripFileSchema = z.object({ v: z.literal(1), trip: tripSchema })
export const prefsFileSchema = z.object({ v: z.literal(1), prefs: prefsSchema })
export const ratesFileSchema = z.object({ v: z.literal(1), savedAt: z.string(), data: ratesDataSchema })
