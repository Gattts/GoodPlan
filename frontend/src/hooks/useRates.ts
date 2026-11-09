/** Cotações do dia: a guardada no navegador aparece na hora; a nova substitui quando a API responde. */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { fetchLatestRates, type RatesData } from '@/lib/api'
import { useStores } from '@/state/stores-context'
import { loadRatesCache, saveRatesCache } from '@/storage/stores'

const ONE_HOUR_MS = 60 * 60 * 1000

export function useRates() {
  const { storage } = useStores()
  const cached = useMemo(() => loadRatesCache(storage), [storage])
  const query = useQuery({
    queryKey: ['rates'],
    queryFn: ({ signal }) => fetchLatestRates(signal),
    initialData: cached?.data,
    // A cópia guardada vale pela idade dela: guardada há mais de 1 hora, a API é consultada ao abrir.
    initialDataUpdatedAt: cached ? Date.parse(cached.savedAt) : undefined,
    staleTime: ONE_HOUR_MS,
  })
  const data: RatesData | null = query.data ?? null

  useEffect(() => {
    if (data && data !== cached?.data) saveRatesCache(storage, data, new Date())
  }, [data, cached, storage])

  return useMemo(() => {
    const list = data?.rates ?? []
    return {
      data,
      rates: Object.fromEntries(list.map((rate) => [rate.currency, rate.brl_per_unit])),
      dates: Object.fromEntries(list.map((rate) => [rate.currency, rate.date])),
      names: Object.fromEntries(list.map((rate) => [rate.currency, rate.name])),
      isFetching: query.isFetching,
      /** A consulta falhou e não há cotação guardada para mostrar. */
      isError: query.isError && data === null,
    }
  }, [data, query.isFetching, query.isError])
}
