# Encontrei Barato

Comparador de preços entre mercados, com foco em busca rápida, comparação visual por loja e suporte à regionalização por cidade e estado.

## Visualização online

O projeto está em produção em:

- [encontreibarato.com.br](https://encontreibarato.com.br)

## Versão atual

- Versão: `1.5.0`
- Última atualização documentada: `2026-04-23`
- Histórico completo: [CHANGELOG.md](./CHANGELOG.md)

## O que o projeto faz

- pesquisa um produto em vários mercados ao mesmo tempo
- organiza os resultados por mercado
- destaca comparações de preço entre lojas
- exibe promoções por quantidade quando disponíveis
- permite ordenar os produtos por nome e preço
- aplica cache e deduplicação para evitar requisições repetidas
- registra métricas operacionais em SQLite
- disponibiliza um painel administrativo privado para acompanhamento

## Interface

As atualizações mais recentes da interface incluem:

- visual mais escuro e moderno
- barra de busca centralizada como foco principal da home
- cards dos mercados redesenhados
- bloco de comparação com nova hierarquia visual
- modal de doação alinhado ao novo visual
- filtro de ordenação por:
  - menor preço
  - maior preço
  - nome A-Z
  - nome Z-A

## Mercados integrados

- Atacadão
- Barracão
- Confiança
- Oba Hortifruti
- Sam's Club
- San Michel
- Tauste
- Tenda Atacado

## Cobertura regional

Hoje a busca funciona por `cidade` e `estado`.

- a interface mostra apenas localidades cadastradas em `lib/regions.ts`
- `Bauru/SP` continua como seleção padrão
- cidades com múltiplas unidades usam uma loja de referência interna
- o Oba já conta com agrupamento por cidade para evitar excesso de opções na interface

## Stack principal

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI
- Cheerio
- SQLite nativo do Node.js

## Estrutura resumida

```text
app/
  admin/metrics/page.tsx   # dashboard privado de métricas
  api/search/route.ts      # API principal de busca
  layout.tsx               # layout global
  page.tsx                 # página inicial

components/
  market-column.tsx
  search-bar.tsx
  ui/

docs/
  scrapers/                # documentação detalhada por mercado

lib/
  metrics/
  regions.ts
  oba-locations.ts
  scrapers/

public/
  images/
  markets/
```

## Como clonar e rodar localmente

### 1. Clonar o repositório

```bash
git clone https://github.com/imduuh/EncontreiBarato.git
cd EncontreiBarato/encontreibarato
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

No Windows PowerShell, você pode usar:

```powershell
Copy-Item .env.example .env.local
```

Depois ajuste as credenciais da área administrativa em `.env.local`.

Exemplo:

```env
ADMIN_METRICS_USERNAME=admin
ADMIN_METRICS_PASSWORD=troque-por-uma-senha-forte
METRICS_SQLITE_PATH=./data/metrics.sqlite
```

Sempre reinicie o servidor depois de criar ou alterar o `.env.local`.

### 4. Iniciar o ambiente de desenvolvimento

```bash
npm run dev
```

### 5. Abrir no navegador

- Aplicação: [http://localhost:3000](http://localhost:3000)
- Admin de métricas: [http://localhost:3000/admin/metrics](http://localhost:3000/admin/metrics)

## Scripts disponíveis

- `npm run dev` inicia o ambiente de desenvolvimento
- `npm run build` gera a build de produção
- `npm run start` inicia a aplicação em modo produção
- `npm run lint` executa a checagem de lint

## Como a busca funciona

1. O usuário informa o produto e escolhe cidade e estado.
2. A interface chama `GET /api/search`.
3. A API resolve a localidade em `lib/regions.ts`.
4. O sistema verifica cache por busca e região.
5. Apenas os mercados habilitados para aquela região são executados.
6. Os scrapers rodam em paralelo.
7. A API normaliza a resposta, registra métricas e devolve os resultados.

## API principal

Endpoint de exemplo:

```http
GET /api/search?q=banana&city=Bauru&state=SP
```

Regras principais:

- aceita `q`, `city`, `state` e, quando necessário, `locationKey`
- exige no mínimo 3 caracteres em `q`
- limita a busca a 100 caracteres
- usa cache em memória por 15 minutos
- deduplica buscas idênticas em andamento
- aplica timeout por mercado
- mantém a API funcional mesmo quando um mercado falha

## Métricas e área administrativa

O painel privado em `/admin/metrics` mostra:

- latência com `p50`, `p90`, `p95` e `p99`
- latência média, mínima e máxima
- `RPS` recente
- `cache hit rate` e `cache miss rate`
- total de buscas
- taxa de sucesso da API
- métricas por mercado, incluindo erro, timeout e volume médio de produtos

### Segurança

O acesso à área administrativa é protegido por autenticação básica usando:

- `ADMIN_METRICS_USERNAME`
- `ADMIN_METRICS_PASSWORD`

### Persistência

As métricas são salvas em SQLite local, por padrão em:

- `./data/metrics.sqlite`

Esse arquivo:

- não deve ser versionado
- não é exposto publicamente
- é ignorado pelo Git

## Documentação dos scrapers

O README principal fica focado em uso, setup e arquitetura geral. O detalhamento de cada integração está em arquivos dedicados:

- [Visão geral dos scrapers](./docs/scrapers/README.md)
- [Atacadão](./docs/scrapers/atacadao.md)
- [Barracão](./docs/scrapers/barracao.md)
- [Confiança](./docs/scrapers/confianca.md)
- [Oba Hortifruti](./docs/scrapers/oba.md)
- [Sam's Club](./docs/scrapers/samsclub.md)
- [San Michel](./docs/scrapers/sanmichel.md)
- [Tauste](./docs/scrapers/tauste.md)
- [Tenda Atacado](./docs/scrapers/tenda.md)

## Observações

- SQLite funciona muito bem localmente e em ambientes self-hosted.
- Em ambiente serverless, a persistência local pode não ser durável entre instâncias.
- A cobertura geográfica cresce conforme novos mercados e localidades são validados.
