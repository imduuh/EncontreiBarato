# Encontrei Barato

Comparador de preços entre mercados, com foco em busca rápida de produtos, consolidação visual por loja e suporte à regionalização por cidade e estado.

O projeto nasceu com um recorte regional, mas a arquitetura foi evoluída para suportar múltiplas cidades, lojas e contextos de entrega sem depender de uma única configuração fixa.

## Visualização Online

O Encontrei Barato está online para visualização e testes em produção:

[encontreibarato.com.br](https://encontreibarato.com.br)

## Versão Atual

- Versão: `1.3.0`
- Última release documentada: `2026-04-06`
- Histórico completo: [CHANGELOG.md](CHANGELOG.md)

## Visão Geral

O Encontrei Barato foi construído para resolver um problema simples: pesquisar um produto uma vez e comparar, em poucos segundos, quanto ele custa em diferentes mercados.

Hoje o sistema consulta:

- Barracão
- Oba Hortifruti
- Tenda Atacado
- Sam's Club
- Tauste
- Confiança
- Atacadão

Cada mercado tem um scraper próprio, porque cada site usa estrutura, API, HTML, sessão e regras diferentes.

## O Que o Projeto Faz

- Busca produtos em vários mercados em paralelo
- Exibe os resultados separados por coluna de mercado
- Destaca o menor preço encontrado para cada produto equivalente
- Mostra preços promocionais por quantidade quando disponíveis
- Permite ocultar produtos indisponíveis na interface
- Usa cache em memória para reduzir repetição de requisições
- Deduplica buscas idênticas em andamento
- Aplica timeout por mercado para evitar esperas excessivas
- Mantém logs detalhados para diagnóstico dos scrapers
- Registra métricas de latência, cache, throughput e saúde dos scrapers em SQLite
- Disponibiliza um dashboard privado para acompanhamento operacional

## Busca Regional

Hoje a API recebe:

- `q`
- `city`
- `state`
- `locationKey`

O `locationKey` hoje funciona como identificador técnico interno da cidade selecionada. Ele continua sendo usado pela API e pelo cache, mas a interface mostra apenas cidade e estado. Quando uma cidade possui várias unidades, o sistema escolhe uma loja de referência internamente para manter a busca simples.

Atualmente:

- a interface mostra apenas estados e cidades cadastrados em [lib/regions.ts](lib/regions.ts)
- `Bauru/SP` fica selecionada por padrão
- a cobertura ativa inclui as 72 localidades do Oba Delivery
- Bauru continua habilitando também os mercados já existentes do projeto
- a validação automatizada do Oba confirmou `regionId` em todas as 72 localidades e `seller` compatível em 68 delas; as 4 restantes ficaram com retorno ambíguo da própria API do Oba
- as 72 localidades do Oba são agrupadas internamente por cidade para evitar poluição visual na busca

Arquivos principais dessa camada:

- [lib/regions.ts](lib/regions.ts)
- [lib/oba-locations.ts](lib/oba-locations.ts)
- [components/search-bar.tsx](components/search-bar.tsx)

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI / componentes no estilo shadcn
- Cheerio para parsing de HTML
- SQLite nativo do Node.js para persistência de métricas

## Estrutura do Projeto

```text
app/
  admin/metrics/page.tsx     # dashboard privado de métricas
  api/search/route.ts        # API principal de busca
  layout.tsx                 # layout global
  page.tsx                   # página inicial
  icon.tsx                   # favicon dinâmico

components/
  search-bar.tsx             # formulário de busca por produto, cidade e estado
  market-column.tsx          # coluna de resultados por mercado
  ui/                        # componentes reutilizáveis de interface

lib/
  metrics/
    db.ts                    # inicialização do SQLite
    service.ts               # gravação e agregação das métricas
  oba-locations.ts           # 72 localidades internas do Oba
  regions.ts                 # agrupamento por cidade e contexto regional
  scrapers/
    atacadao.ts
    barracao.ts
    confianca.ts
    oba.ts
    samsclub.ts
    tauste.ts
    tenda.ts
    logger.ts
    types.ts

proxy.ts                     # proteção da área administrativa
```

## Como Funciona a Busca

1. O usuário informa um produto, escolhe a cidade e o estado na página inicial.
2. A interface chama `GET /api/search?q=...&city=...&state=...&locationKey=...`.
3. A API resolve a cidade em [lib/regions.ts](lib/regions.ts) e seleciona uma loja de referência quando necessário.
4. A API verifica cache por `query + locationKey`.
5. Se não houver cache válido, apenas os scrapers habilitados para aquela localidade são executados.
6. Os mercados são consultados em paralelo com `Promise.allSettled`.
7. Cada scraper transforma o retorno do mercado em um formato comum.
8. A API agrega os resultados, registra as métricas e devolve uma resposta única.
9. A interface renderiza os produtos por mercado e destaca os melhores preços.

## API Principal

Endpoint:

```http
GET /api/search?q=banana&city=Bauru&state=SP&locationKey=bauru-vila-aviacao-sp
```

Arquivo:

[app/api/search/route.ts](app/api/search/route.ts)

### Regras da API

- aceita os parâmetros `q`, `city`, `state` e `locationKey`
- exige mínimo de 3 caracteres em `q`
- aceita no máximo 100 caracteres
- faz cache em memória por 15 minutos
- deduplica buscas idênticas em andamento
- executa os mercados habilitados em paralelo
- aplica timeout por mercado
- registra métricas operacionais em SQLite
- a falha de um mercado não derruba os outros

## Métricas e Dashboard Admin

O projeto possui um painel administrativo privado em:

- `/admin/metrics`

Esse painel exibe:

- `p50`, `p90`, `p95` e `p99` de latência
- latência média, mínima e máxima
- `RPS` dos últimos 5 e 60 minutos
- `cache hit rate` e `cache miss rate`
- total de buscas
- taxa de sucesso da API
- volume de regiões sem cobertura
- métricas por mercado:
  - taxa de sucesso
  - taxa de erro
  - taxa de timeout
  - latência média
  - `p95`
  - `p99`
  - média de produtos retornados

### Segurança

A área administrativa é protegida por autenticação básica via variáveis de ambiente:

- `ADMIN_METRICS_USERNAME`
- `ADMIN_METRICS_PASSWORD`

### Persistência

As métricas são armazenadas em SQLite local, por padrão em:

- `./data/metrics.sqlite`

Esse arquivo:

- não deve ser versionado
- não fica exposto publicamente
- é ignorado pelo Git em [/.gitignore](.gitignore)

## Variáveis de Ambiente

Exemplo em [.env.example](.env.example):

```env
ADMIN_METRICS_USERNAME=admin
ADMIN_METRICS_PASSWORD=troque-por-uma-senha-forte
METRICS_SQLITE_PATH=./data/metrics.sqlite
```

Sempre reinicie o servidor depois de criar ou alterar o `.env.local`.

## Como os Scrapers Funcionam

Cada mercado tem um arquivo próprio em [lib/scrapers](lib/scrapers).

O objetivo de cada scraper é sempre o mesmo:

- buscar produtos no mercado
- extrair nome, imagem, URL e preço
- detectar promoções por quantidade quando disponíveis
- devolver tudo no formato `MarketProduct[]`

### Oba Hortifruti

[lib/scrapers/oba.ts](lib/scrapers/oba.ts)

- resolve a regionalização pela API VTEX de `regions`
- monta o cookie `vtex_segment` com o `regionId` da cidade selecionada
- consulta o endpoint de `intelligent-search` usando `query=...`
- usa uma loja de referência interna para cidades com múltiplas unidades
- cobre as 72 localidades cadastradas em [lib/oba-locations.ts](lib/oba-locations.ts), agrupadas na interface por cidade

### Barracão

[lib/scrapers/barracao.ts](lib/scrapers/barracao.ts)

- usa o catálogo real da loja via `filial/1` e `centro_distribuicao/1`
- interpreta preços promocionais a partir de `oferta.preco_oferta`
- monta URLs de produto no formato `/produto/{produto_id}/{slug}`
- usa imagens hospedadas no bucket de assets da plataforma

### Atacadão

[lib/scrapers/atacadao.ts](lib/scrapers/atacadao.ts)

- usa sessão VTEX com CEP configurado
- tenta busca por APIs VTEX
- interpreta `commertialOffer`, `Teasers` e blocos da página do produto
- faz enriquecimento adicional para detectar preço por quantidade quando necessário
- exige cuidado com disponibilidade regional, seller e sessão

### Tenda

[lib/scrapers/tenda.ts](lib/scrapers/tenda.ts)

- busca em página com forte uso de JavaScript
- tenta extrair JSON embutido no HTML
- faz fallback para parse estrutural da página

### Sam's Club

[lib/scrapers/samsclub.ts](lib/scrapers/samsclub.ts)

- parsing adaptado ao formato do site
- suporte a preço base quando a fonte expõe esse dado

### Tauste

[lib/scrapers/tauste.ts](lib/scrapers/tauste.ts)

- parse de cards Magento 2
- usa seletores HTML e atributos de preço como fonte principal

### Confiança

[lib/scrapers/confianca.ts](lib/scrapers/confianca.ts)

- usa Oracle Commerce Cloud
- combina parsing de listagem e normalização de preço

## Observações

- O SQLite de métricas funciona muito bem em ambiente local e self-hosted.
- Em ambiente serverless, a persistência local depende do provedor e pode não ser durável entre instâncias.
- A cobertura geográfica do projeto cresce conforme novas localidades e novos scrapers são validados.
