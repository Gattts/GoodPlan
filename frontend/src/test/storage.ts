import { createSafeStorage, type SafeStorage } from '@/storage/safe'

/** localStorage de mentira: cada teste começa vazio. `failOn` faz a gravação dessas chaves falhar (cota cheia). */
export class FakeStorage implements Storage {
  private readonly items = new Map<string, string>()
  private readonly failOn: (key: string) => boolean

  constructor(failOn: (key: string) => boolean = () => false) {
    this.failOn = failOn
  }

  get length() {
    return this.items.size
  }

  clear() {
    this.items.clear()
  }

  getItem(key: string) {
    return this.items.get(key) ?? null
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.items.delete(key)
  }

  setItem(key: string, value: string) {
    if (this.failOn(key)) throw new DOMException('Cota cheia', 'QuotaExceededError')
    this.items.set(key, value)
  }
}

export function memoryStorage(failOn?: (key: string) => boolean): SafeStorage {
  const backend = new FakeStorage(failOn)
  return createSafeStorage(() => backend)
}

export function blockedStorage(): SafeStorage {
  return createSafeStorage(() => {
    throw new DOMException('Acesso negado', 'SecurityError')
  })
}
