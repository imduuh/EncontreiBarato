# Encontrei Barato

Comparador de preços entre mercados, com foco em busca rápida de produtos, consolidação visual por loja e suporte a preços promocionais por quantidade.

O projeto nasceu com um recorte inicial regional, mas a proposta do produto é evoluir para um comparador escalável para o Brasil todo, respeitando disponibilidade, cidade, CEP de referência, seller e regras específicas de cada mercado.

## Visualização Online

O Encontrei Barato está disponível online para visualização e testes em produção:

[encontreibarato.com.br](https://encontreibarato.com.br)

## Versão Atual

- Versão: `1.2.0`
- Última release documentada: `2026-04-01`
- Histórico completo: [CHANGELOG.md](CHANGELOG.md)

## Visão Geral

O Encontrei Barato foi construído para resolver um problema simples: pesquisar um produto uma vez e comparar, em poucos segundos, quanto ele custa em diferentes mercados.

Hoje o sistema consulta:

- Barracão
- Tenda Atacado
- Sam's Club
- Tauste
- Confiança
- Atacadão

Cada mercado tem um scraper próprio, porque cada site usa estrutura, API, HTML, sessão e regras diferentes.

## O que o Projeto Faz

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

Além disso:

- a interface mostra apenas estados e cidades cadastrados em [lib/regions.ts](lib/regions.ts)
- `Bauru/SP` permanece como localidade padrão
- a arquitetura já está pronta para expansão para novas cidades
- a cobertura ativa depende da combinação entre cidade e mercados habilitados

Localidades atualmente habilitadas:

- Bauru/SP
- Jaú/SP
- Pederneiras/SP
- Potunduva/SP
- Arealva/SP

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI / componentes no estilo shadcn
- Cheerio para parsing HTML
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
  search-bar.tsx             # formulário de busca
  market-column.tsx          # coluna de resultados por mercado
  ui/                        # componentes reutilizáveis de interface

lib/
  metrics/
    db.ts                    # inicialização do SQLite
    service.ts               # gravação e agregação das métricas
  regions.ts                 # localidades suportadas e contexto regional
  scrapers/
    atacadao.ts
    barracao.ts
    confianca.ts
    samsclub.ts
    tauste.ts
    tenda.ts
    logger.ts
    types.ts
  utils.ts

proxy.ts                     # proteção da área administrativa
```

## Como Funciona a Busca

1. O usuário informa um produto, cidade e estado na página inicial.
2. A interface chama `GET /api/search?q=...&city=...&state=...`.
3. A API valida o termo e resolve a região em [lib/regions.ts](lib/regions.ts).
4. A API verifica cache por `query + cidade + estado`.
5. Se não houver cache válido, apenas os scrapers habilitados para aquela localidade são executados.
6. Os mercados são consultados em paralelo com `Promise.allSettled`.
7. Cada scraper transforma o retorno do mercado em um formato comum.
8. A API agrega os resultados, registra as métricas e devolve uma resposta única.
9. A interface renderiza os produtos por mercado e destaca os melhores preços.

## API Principal

Endpoint:

```http
GET /api/search?q=nutella%20650g&city=Bauru&state=SP
```

Arquivo:

[app/api/search/route.ts](app/api/search/route.ts)

### Regras da API

- aceita os parâmetros `q`, `city` e `state`
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

## Como os Scrapers Funcionam

Cada mercado tem um arquivo próprio em [lib/scrapers](lib/scrapers).

O objetivo de cada scraper é sempre o mesmo:

- buscar produtos no mercado
- extrair nome, imagem, URL e preço
- detectar promoções por quantidade
- devolver tudo no formato `MarketProduct[]`

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
- normaliza a resposta para o formato unificado do projeto

## Logs e Observabilidade

Os logs estão centralizados em:

[lib/scrapers/logger.ts](lib/scrapers/logger.ts)

Tipos de log usados no projeto:

- `info`
- `success`
- `warn`
- `error`
- `debug`
- `request`
- `response`

Isso ajuda bastante a identificar:

- mudanças de layout nos mercados
- erros de parse
- problemas de disponibilidade regional
- divergências entre busca e página do produto

## Interface

Os principais componentes visuais são:

- [app/page.tsx](app/page.tsx)
- [components/search-bar.tsx](components/search-bar.tsx)
- [components/market-column.tsx](components/market-column.tsx)

Recursos da UI:

- busca centralizada no header
- seleção de estado e cidade a partir das localidades suportadas
- Bauru como localidade padrão
- colunas por mercado com layout escalável
- destaque do menor preço global
- exibição de preço de atacado em separado
- filtro para produtos indisponíveis

## Instalação

### Requisitos

- Node.js 22 ou superior
- npm

### Passo a Passo

```bash
git clone https://github.com/imduuh/EncontreiBarato.git
cd encontreibarato
npm install
cp .env.example .env.local
```

Depois configure suas credenciais da área administrativa em `.env.local`.

Observação:

- o arquivo precisa existir na raiz do projeto
- após criar ou alterar `.env.local`, reinicie o servidor `npm run dev`

### Rodando em Desenvolvimento

```bash
npm run dev
```

Depois abra:

[http://localhost:3000](http://localhost:3000)

### Build de Produção

```bash
npm run build
npm run start
```

## Contribuindo

Contribuições são bem-vindas, principalmente em:

- manutenção e ajustes dos scrapers
- tratamento de disponibilidade por região
- melhorias de interface
- aumento de resiliência contra mudanças de HTML
- melhorias de performance e cache
- melhorias na observabilidade
- expansão do projeto para novas cidades, regiões e mercados

## Limites e Observações Importantes

- os mercados podem mudar HTML, endpoints e regras a qualquer momento
- disponibilidade e preço podem variar por cidade, CEP, loja, seller e sessão
- o projeto depende de scraping e integrações não oficiais
- parte dos dados pode ficar temporariamente inconsistente quando o mercado diverge entre busca e PDP
- o cache em memória é local ao processo e não compartilhado entre instâncias
- o banco de métricas em SQLite é local à instância em execução

## Licença

Este projeto utiliza a licença presente no repositório.
