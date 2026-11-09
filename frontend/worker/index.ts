/**
 * Worker do Cloudflare: serve o front (arquivos estáticos de `dist/`), repassa `/api/*` à API com o segredo do
 * proxy, responde a cotação a partir do KV (instantâneo mesmo com o Render dormindo) e roda o agendador das
 * rotinas. Os cabeçalhos de segurança das páginas vêm de `public/_headers`.
 */

export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Endereço público da API, ex.: https://goodplan-api.onrender.com */
  BACKEND_ORIGIN: string
  /** Segredo compartilhado com a API (GP_PROXY_SECRET). */
  PROXY_SECRET: string
  /** Token da rota das rotinas (GP_JOBS_TOKEN). */
  JOBS_TOKEN: string
  /** Cópia da última cotação, gravada pelo agendador. */
  RATES: KVLike
}

export interface Ctx {
  waitUntil(promise: Promise<unknown>): void
}

export const RATES_KEY = 'rates:latest'
const RATES_PATH = '/api/rates/latest'
const RUN_DUE_PATH = '/api/internal/jobs/run-due'
const KV_CACHE_CONTROL = 'public, max-age=300'
// Cabeçalhos que só o Worker pode definir, ou que levariam o IP de quem visita à API: nunca são repassados.
const PROXY_HEADERS = [
  'cf-connecting-ip',
  'true-client-ip',
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-proxy-secret',
]
const MAX_BODY_BYTES = 1024 * 1024

const isApi = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/')
/** Compara o caminho já decodificado: "/api/%69nternal" também é a rota interna. Caminho malformado não passa. */
function isInternal(pathname: string): boolean {
  try {
    const decoded = decodeURIComponent(pathname)
    return decoded === '/api/internal' || decoded.startsWith('/api/internal/')
  } catch {
    return true
  }
}
const configured = (env: Env) => Boolean(env.BACKEND_ORIGIN && env.PROXY_SECRET)
const regionalCache = () => (caches as unknown as { default: Cache }).default

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ detail: 'Requisição grande demais.' }, { status: 413 })
  }
  const incoming = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.delete('host')
  for (const name of PROXY_HEADERS) headers.delete(name)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
  headers.set('x-proxy-secret', env.PROXY_SECRET)
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  return fetch(
    new Request(new URL(incoming.pathname + incoming.search, env.BACKEND_ORIGIN), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    }),
  )
}

async function handleApi(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (isInternal(pathname)) return Response.json({ detail: 'Não encontrado.' }, { status: 404 })
  if (!configured(env)) {
    return Response.json({ detail: 'A API não está configurada neste servidor.' }, { status: 503 })
  }
  if (request.method === 'GET' && pathname === RATES_PATH) {
    const copy = await env.RATES.get(RATES_KEY)
    if (copy) {
      return new Response(copy, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': KV_CACHE_CONTROL },
      })
    }
  }
  if (request.method === 'GET' && pathname.startsWith('/api/airports/')) {
    const hit = await regionalCache().match(request)
    if (hit) return hit
    const response = await proxyToBackend(request, env)
    if (response.ok && (response.headers.get('cache-control') ?? '').includes('public')) {
      ctx.waitUntil(regionalCache().put(request, response.clone()))
    }
    return response
  }
  return proxyToBackend(request, env)
}

/** Busca a cotação na API e grava no KV; uma resposta vazia ou com erro não apaga a cópia anterior. */
export async function refreshRates(env: Env): Promise<void> {
  try {
    const response = await fetch(new URL(RATES_PATH, env.BACKEND_ORIGIN), {
      headers: { 'x-proxy-secret': env.PROXY_SECRET },
    })
    if (!response.ok) {
      console.error(`cotação: a API respondeu ${response.status}`)
      return
    }
    const body = await response.text()
    const parsed = JSON.parse(body) as { rates?: unknown }
    if (!Array.isArray(parsed.rates) || parsed.rates.length === 0) return
    await env.RATES.put(RATES_KEY, body)
  } catch (error) {
    console.error('cotação: falha ao atualizar o KV', error)
  }
}

/** Agendador (0 12,20 * * *): roda as rotinas na API e, mesmo se falharem, atualiza a cópia da cotação. */
export async function runScheduled(env: Env): Promise<void> {
  if (!configured(env) || !env.JOBS_TOKEN) {
    console.error('agendador: faltam BACKEND_ORIGIN, PROXY_SECRET ou JOBS_TOKEN')
    return
  }
  try {
    const response = await fetch(new URL(RUN_DUE_PATH, env.BACKEND_ORIGIN), {
      method: 'POST',
      headers: { 'x-proxy-secret': env.PROXY_SECRET, authorization: `Bearer ${env.JOBS_TOKEN}` },
    })
    console.log(`rotinas: ${response.status} ${await response.text()}`)
  } catch (error) {
    console.error('rotinas: a chamada falhou', error)
  }
  await refreshRates(env)
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    if (isApi(new URL(request.url).pathname)) return handleApi(request, env, ctx)
    return env.ASSETS.fetch(request)
  },
  scheduled(_controller: { cron: string; scheduledTime: number }, env: Env, ctx: Ctx): void {
    ctx.waitUntil(runScheduled(env))
  },
}
