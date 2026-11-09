// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { RATES_KEY, type Ctx, type Env } from './index'

const RATES = {
  base: 'BRL',
  source: { name: 'Frankfurter', url: 'https://frankfurter.dev' },
  latest_date: '2026-11-05',
  fetched_at: '2026-11-05T20:00:07Z',
  rates: [{ currency: 'EUR', name: 'Euro', brl_per_unit: 6.14628, date: '2026-11-05' }],
}

let kv: Map<string, string>
let env: Env
let pending: Promise<unknown>[]
let ctx: Ctx
let cacheStore: Map<string, Response>

beforeEach(() => {
  kv = new Map()
  pending = []
  ctx = { waitUntil: (promise) => void pending.push(promise) }
  env = {
    ASSETS: { fetch: vi.fn(async () => new Response('<html>app</html>')) },
    BACKEND_ORIGIN: 'https://api.exemplo.com',
    PROXY_SECRET: 'segredo-compartilhado',
    JOBS_TOKEN: 'token-das-rotinas',
    RATES: {
      get: async (key) => kv.get(key) ?? null,
      put: async (key, value) => void kv.set(key, value),
    },
  }
  cacheStore = new Map()
  vi.stubGlobal('caches', {
    default: {
      match: async (request: Request) => cacheStore.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => void cacheStore.set(request.url, response),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubBackend(handler: (request: Request) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const backend = vi.fn(async (input: Request | string | URL, init?: RequestInit) =>
    handler(input instanceof Request ? input : new Request(input, init)),
  )
  vi.stubGlobal('fetch', backend)
  return backend
}

const get = (path: string, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://goodplan.exemplo${path}`, { headers }), env, ctx)

describe('Worker: pedidos de quem visita', () => {
  it('cotação vem do KV, sem chamar a API', async () => {
    const backend = stubBackend()
    kv.set(RATES_KEY, JSON.stringify(RATES))
    const response = await get('/api/rates/latest')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual(RATES)
    expect(backend).not.toHaveBeenCalled()
  })

  it('KV vazio: busca na API com o segredo', async () => {
    const backend = stubBackend(() => Response.json(RATES))
    const response = await get('/api/rates/latest')
    expect(await response.json()).toEqual(RATES)
    const sent = backend.mock.calls[0][0] as Request
    expect(sent.url).toBe('https://api.exemplo.com/api/rates/latest')
    expect(sent.headers.get('x-proxy-secret')).toBe('segredo-compartilhado')
  })

  it('rota interna responde 404 para quem vem de fora', async () => {
    const backend = stubBackend()
    const response = await worker.fetch(
      new Request('https://goodplan.exemplo/api/internal/jobs/run-due', { method: 'POST' }),
      env,
      ctx,
    )
    expect(response.status).toBe(404)
    expect(backend).not.toHaveBeenCalled()
  })

  it.each(['/api/%69nternal/jobs/run-due', '/api/internal%2Fjobs%2Frun-due', '/api/%E0%A4%A/malformado'])(
    'rota interna disfarçada com percent-encoding também responde 404 (%s)',
    async (path) => {
      const backend = stubBackend()
      const response = await worker.fetch(new Request(`https://goodplan.exemplo${path}`, { method: 'POST' }), env, ctx)
      expect(response.status).toBe(404)
      expect(backend).not.toHaveBeenCalled()
    },
  )

  it('não envia o IP de quem visita para a API', async () => {
    const backend = stubBackend()
    await get('/api/airports/LIS', { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.9' })
    const sent = backend.mock.calls[0][0] as Request
    expect(sent.headers.get('x-forwarded-for')).toBeNull()
    expect(sent.headers.get('cf-connecting-ip')).toBeNull()
  })

  it('repassa o resto de /api trocando o segredo forjado', async () => {
    const backend = stubBackend()
    await get('/api/airports/search?q=li&limit=8', { 'x-proxy-secret': 'chute' })
    const sent = backend.mock.calls[0][0] as Request
    expect(sent.url).toBe('https://api.exemplo.com/api/airports/search?q=li&limit=8')
    expect(sent.headers.get('x-proxy-secret')).toBe('segredo-compartilhado')
  })

  it('guarda a busca de aeroportos no cache regional', async () => {
    const backend = stubBackend(() =>
      Response.json([{ iata: 'LIS' }], { headers: { 'cache-control': 'public, max-age=86400' } }),
    )
    await get('/api/airports/search?q=lisboa&limit=8')
    await Promise.all(pending)
    const second = await get('/api/airports/search?q=lisboa&limit=8')
    expect(await second.json()).toEqual([{ iata: 'LIS' }])
    expect(backend).toHaveBeenCalledTimes(1)
  })

  it('o resto vem dos arquivos estáticos', async () => {
    const backend = stubBackend()
    await get('/qualquer/caminho')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(backend).not.toHaveBeenCalled()
  })

  it('sem configuração, recusa com 503 em vez de chamar a API sem o segredo', async () => {
    const backend = stubBackend()
    env = { ...env, PROXY_SECRET: '' }
    const response = await get('/api/airports/LIS')
    expect(response.status).toBe(503)
    expect(backend).not.toHaveBeenCalled()
  })
})

describe('Worker: agendador', () => {
  it('roda as rotinas e grava a cotação nova no KV', async () => {
    const backend = stubBackend((request) =>
      request.url.endsWith('/run-due') ? Response.json({ jobs: [] }) : Response.json(RATES),
    )
    worker.scheduled({ cron: '0 12,20 * * *', scheduledTime: 0 }, env, ctx)
    await Promise.all(pending)
    const [runDue, rates] = backend.mock.calls.map(([input, init]) =>
      input instanceof Request ? input : new Request(input, init),
    )
    expect(runDue.method).toBe('POST')
    expect(runDue.url).toBe('https://api.exemplo.com/api/internal/jobs/run-due')
    expect(runDue.headers.get('authorization')).toBe('Bearer token-das-rotinas')
    expect(runDue.headers.get('x-proxy-secret')).toBe('segredo-compartilhado')
    expect(rates.url).toBe('https://api.exemplo.com/api/rates/latest')
    expect(JSON.parse(kv.get(RATES_KEY)!)).toEqual(RATES)
  })

  it('mesmo com run-due falhando, atualiza o KV', async () => {
    stubBackend((request) => {
      if (request.url.endsWith('/run-due')) throw new TypeError('API dormindo')
      return Response.json(RATES)
    })
    worker.scheduled({ cron: '0 12,20 * * *', scheduledTime: 0 }, env, ctx)
    await Promise.all(pending)
    expect(JSON.parse(kv.get(RATES_KEY)!)).toEqual(RATES)
  })

  it('cotação vazia não sobrescreve o KV', async () => {
    kv.set(RATES_KEY, JSON.stringify(RATES))
    stubBackend((request) =>
      request.url.endsWith('/run-due') ? Response.json({ jobs: [] }) : Response.json({ ...RATES, rates: [] }),
    )
    worker.scheduled({ cron: '0 12,20 * * *', scheduledTime: 0 }, env, ctx)
    await Promise.all(pending)
    expect(JSON.parse(kv.get(RATES_KEY)!)).toEqual(RATES)
  })
})
