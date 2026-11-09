/**
 * localStorage que nunca derruba a página: em aba anônima com armazenamento bloqueado, ou com a cota cheia, os
 * dados ficam em memória e `set` devolve false (a tela avisa que não vai lembrar da viagem).
 */
export type SafeStorage = {
  available: boolean
  get(key: string): string | null
  set(key: string, value: string): boolean
}

const PROBE_KEY = 'goodplan:probe'

export function createSafeStorage(getBackend: () => Storage = () => window.localStorage): SafeStorage {
  let backend: Storage | null
  try {
    backend = getBackend()
    backend.setItem(PROBE_KEY, '1')
    backend.removeItem(PROBE_KEY)
  } catch {
    backend = null
  }
  const memory = new Map<string, string>()
  // Chaves cuja última gravação falhou: valem as da memória, não as (antigas) do navegador.
  const failed = new Set<string>()

  return {
    available: backend !== null,
    get(key) {
      if (backend && !failed.has(key)) {
        try {
          return backend.getItem(key)
        } catch {
          // lê da memória abaixo
        }
      }
      return memory.get(key) ?? null
    },
    set(key, value) {
      memory.set(key, value)
      if (!backend) return false
      try {
        backend.setItem(key, value)
        failed.delete(key)
        return true
      } catch {
        failed.add(key)
        return false
      }
    },
  }
}
