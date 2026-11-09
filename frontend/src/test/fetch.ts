import { vi } from 'vitest'

export type FakeReply = unknown | { status: number } | (() => Promise<Response>)

const isStatus = (reply: unknown): reply is { status: number } =>
  typeof reply === 'object' && reply !== null && Object.keys(reply).length === 1 && 'status' in reply

/** fetch de mentira: cada caminho (com a consulta) devolve o JSON dado, um status de erro ou uma promessa própria. */
export function stubFetch(routes: Record<string, FakeReply>) {
  const fake = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.startsWith('http') ? url.slice(new URL(url).origin.length) : url
    const reply = routes[path]
    if (reply === undefined) return new Response(null, { status: 404 })
    if (typeof reply === 'function') return (reply as () => Promise<Response>)()
    if (isStatus(reply)) return new Response(null, { status: reply.status })
    return Response.json(reply)
  })
  vi.stubGlobal('fetch', fake)
  return fake
}
