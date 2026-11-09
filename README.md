# GoodPlan

Planejador de viagens e mudanças para fora do Brasil: monte a viagem num cartão de embarque e veja em reais quanto
vai gastar na estadia, com a cotação do dia, IOF e spread. Projeto do portfólio de [jpaulos.dev](https://jpaulos.dev),
construído em partes. Esta é a parte 1, a fundação.

## O que já funciona

- **Cartão da viagem**: origem, destino, datas, pessoas, moeda local e gasto por dia. O canhoto mostra o custo da
  estadia em reais. A viagem fica salva no navegador; não precisa de conta.
- **Busca de aeroporto** por código, cidade, país ou nome em português ("tóquio", "lisboa", "GRU").
- **Calculadora de câmbio** com a cotação do dia, IOF e spread editáveis, cotação própria e tabela de valores comuns.
- **Cotação servida pelo Cloudflare**: abre na hora mesmo com a API dormindo (plano gratuito do Render).
- **Rotinas diárias**: câmbio (Frankfurter) e aeroportos (OurAirports), com registro de cada execução.

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Postgres 17 (Supabase), httpx2 e Babel (Unicode CLDR).
- **Front**: React 19, TypeScript, Vite, Tailwind 4, TanStack Query, zod e Radix.
- **Borda**: Cloudflare Worker (arquivos estáticos, proxy da API, KV e agendador).
- **Testes**: pytest (SQLite e Postgres), Vitest com Testing Library, Playwright com axe.
- **Deploy**: Render (Docker, plano gratuito), Supabase (gratuito) e Cloudflare (gratuito).

## Estrutura

```
backend/    API (src/goodplan), migrações, testes e Dockerfile
frontend/   app React (src), Worker do Cloudflare (worker), testes de ponta a ponta (e2e)
compose.yaml  Postgres 17 local
render.yaml   Blueprint do Render
```

## Rodar localmente

### Backend

```bash
cd backend
uv sync
uv run goodplan migrate              # sem configuração, usa um SQLite em backend/data/goodplan.db
uv run goodplan jobs run rates       # busca as cotações no Frankfurter (precisa de internet)
uv run goodplan jobs run airports    # baixa os aeroportos do OurAirports
uv run goodplan serve                # http://127.0.0.1:8000/api/health
```

Sem internet, as rotinas leem os arquivos de teste:
`uv run goodplan jobs run rates --file tests/fixtures/frankfurter_brl.json` e
`uv run goodplan jobs run airports --file tests/fixtures/airports_sample.csv`.

Para usar o Postgres local (porta 5433, para não conflitar com outros projetos), suba o banco com
`docker compose up -d` (ou, sem o plugin do Compose, com
`docker run -d --name goodplan-pg -e POSTGRES_DB=goodplan -e POSTGRES_USER=goodplan -e POSTGRES_PASSWORD=goodplan-local -p 127.0.0.1:5433:5432 postgres:17-alpine`)
e copie `backend/.env.example` para `backend/.env` com
`GP_DATABASE_URL=postgresql://goodplan:goodplan-local@127.0.0.1:5433/goodplan`.

### Front

```bash
cd frontend
npm ci
npm run dev                          # http://localhost:5173 (o Vite repassa /api para a porta 8000)
```

### Worker (opcional)

Copie `frontend/.dev.vars.example` para `frontend/.dev.vars` e rode `npm run cf:dev`: o Worker serve o build e
repassa `/api` para a API local.

## Testes

```bash
cd backend
uv run pytest                                            # SQLite
GP_TEST_DATABASE_URL=postgresql://goodplan:goodplan-local@127.0.0.1:5433/goodplan uv run pytest   # Postgres 17
uv run ruff check src tests && uv run ruff format --check src tests && uv run mypy src

cd ../frontend
npm test && npm run lint && npm run typecheck && npm run format:check
npx playwright install chromium && npm run e2e           # sobe a API e o front sozinhos
```

Os testes nunca leem `GP_DATABASE_URL` (pode ser o banco de produção) nem acessam a internet: as fontes externas são
simuladas a partir de `backend/tests/fixtures/`. A CI roda tudo isso a cada push, inclusive a suíte no Postgres e o
build da imagem Docker.

## Rotinas e `job_runs`

O agendador do Worker chama `POST /api/internal/jobs/run-due` às 12h e às 20h UTC. A API roda o câmbio sempre e os
aeroportos quando estão na hora (nunca importados, mais de 30 dias, ou o arquivo de nomes em português mudou). Cada
execução fica na tabela `job_runs`, com resultado e detalhe; depois, o Worker grava a cotação nova no KV.

A rota interna exige o token `GP_JOBS_TOKEN` e não aceita pedidos de fora (o Worker responde 404). Na linha de
comando, o mesmo é `uv run goodplan jobs run-due`.

## Deploy

Você precisa de contas no Supabase, no Render e no Cloudflare (onde o domínio jpaulos.dev já está). Gere dois segredos
com `openssl rand -hex 32`: um para o proxy (`PROXY_SECRET`) e outro para as rotinas (`JOBS_TOKEN`).

### 1. Supabase

1. Crie um projeto gratuito na região **us-east-1** (Virgínia), a mesma da API no Render.
2. Em Connect → Session pooler, copie a URI (porta 5432) e troque `[YOUR-PASSWORD]` pela senha do banco. A conexão
   direta só tem IPv6, e o Render não acessa IPv6.

### 2. Render

1. New → Blueprint → escolha este repositório. O `render.yaml` cria o serviço `goodplan-api` (Docker, plano gratuito,
   região `virginia`; se o plano gratuito não existir lá, troque para `ohio`, a região mais próxima).
2. Preencha `GP_DATABASE_URL` (a URI do Session pooler), `GP_PROXY_SECRET` e `GP_JOBS_TOKEN`. `GP_PROXY_ONLY=true` já
   vem do Blueprint: a API só atende o Worker.
3. Depois do deploy, anote o endereço (ex.: `https://goodplan-api.onrender.com`) e confira
   `https://<endereço>/api/health`. A imagem aplica as migrações ao subir; cada push na `main` publica de novo.

### 3. Cloudflare

```bash
cd frontend
npx wrangler login
npx wrangler kv namespace create RATES   # copie o id para kv_namespaces em wrangler.jsonc
npx wrangler secret put PROXY_SECRET     # o mesmo valor de GP_PROXY_SECRET
npx wrangler secret put JOBS_TOKEN       # o mesmo valor de GP_JOBS_TOKEN
```

Troque `BACKEND_ORIGIN` em `wrangler.jsonc` pelo endereço do Render e publique com `npm run cf:deploy`. A rota
`goodplan.jpaulos.dev` cria o DNS e o certificado sozinha.

### 4. Primeira execução

```bash
curl -X POST "https://<endereço-do-render>/api/internal/jobs/run-due" \
  -H "X-Proxy-Secret: <PROXY_SECRET>" -H "Authorization: Bearer <JOBS_TOKEN>"
```

A resposta lista as rotinas (`rates` e `airports`, ambas `ok`). Confira no editor SQL do Supabase:

```sql
select job, status, detail, started_at from job_runs order by id desc limit 5;
```

O KV recebe a cotação no próximo horário do agendador (12h ou 20h UTC); até lá, o Worker busca a cotação na API.

## Operação e limites gratuitos

- Logs: painel do Render, `npx wrangler tail` (Worker) e a tabela `job_runs`.
- Render: 750 horas por mês somadas entre os serviços gratuitos da conta; a API dorme depois de 15 minutos sem uso e
  leva cerca de 1 minuto para acordar (a cotação vem do KV e o cartão funciona sem a API).
- Supabase: pausa depois de 7 dias sem uso; as rotinas diárias mantêm o projeto ativo.
- Cloudflare: o agendador usa 1 dos 5 gatilhos da conta, e o KV recebe 2 das 1.000 gravações diárias.

## Fontes de dados e licenças

- [Frankfurter](https://frankfurter.dev): cotações combinadas de bancos centrais; gratuito, inclusive para uso
  comercial, e permite guardar as cotações.
- [OurAirports](https://ourairports.com/data/): domínio público, sem garantia de exatidão.
- [Unicode CLDR](https://cldr.unicode.org), via Babel: nomes de países e moedas e a moeda de cada país (Babel: BSD;
  CLDR: Licença Unicode).
- Fontes Big Shoulders Display, Barlow e DM Mono: SIL Open Font License, servidas pelo próprio app (Fontsource).
- IOF de 3,5% para cartão e dinheiro em espécie (Decreto nº 12.499/2025), conferido em 05/11/2026.

## Migração futura para o AWS Lightsail

O backend já está pronto para trocar de hospedagem: é uma imagem Docker sem estado, configurada só por variáveis
`GP_*`, que aplica as migrações ao subir. Para migrar: escolher entre instância e serviço de containers do Lightsail,
publicar a mesma imagem, copiar as variáveis, decidir se o banco fica no Supabase (ou migra com dump e restore),
apontar o `BACKEND_ORIGIN` do Worker para o novo endereço e desligar o serviço do Render. O agendador do Worker
continua igual; numa instância, um cron local chamando `goodplan jobs run-due` também serve. O front fica no
Cloudflare.

## Próximas partes

2. Contas e avisos por e-mail · 3. Vias de ida e documentos · 4. Escola · 5. Custo da estadia por categoria ·
6. Voos · 7. Locais · 8. Vagas.
