# Encontrei Barato

Comparador de preços entre mercados, com foco em busca rápida de produtos, consolidação visual por loja e suporte a preços promocionais por quantidade.

O projeto nasceu com um recorte inicial regional, mas a proposta do produto é evoluir para um comparador escalável para o Brasil todo, respeitando disponibilidade, cidade, CEP de referência, seller e regras específicas de cada mercado.

## Visualização Online

O Encontrei Barato está disponível online para visualização e testes em produção:

[encontreibarato.com.br](https://encontreibarato.com.br)

Se você quiser conhecer a interface, validar o funcionamento da busca ou acompanhar a evolução do produto, essa é a melhor forma de acessar a versão publicada.

## Versão Atual

- Versão: `1.1.0`
- Última release documentada: `2026-03-23`
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

## O que o projeto faz

- Busca produtos em vários mercados em paralelo
- Exibe os resultados separados por coluna de mercado
- Destaca o menor preço encontrado para cada produto equivalente
- Mostra preços promocionais por quantidade quando disponíveis
- Permite ocultar produtos indisponíveis na interface
- Usa cache em memória para reduzir repetição de requisições
- Deduplica buscas idênticas em andamento
- Aplica timeout por mercado para evitar esperas excessivas
- Mantém logs detalhados para diagnóstico dos scrapers
- Trata divergências entre busca, página do produto e disponibilidade regional

## Busca Regional

Na versão `1.1.0`, o projeto passou a trabalhar com contexto regional de busca.

Hoje a API recebe:

- `q`
- `city`
- `state`

Além disso:

- a interface mostra apenas estados e cidades cadastrados em [lib/regions.ts](lib/regions.ts)
- a arquitetura já está pronta para expansão para novas cidades
- neste momento, a cobertura ativa depende da combinação entre cidade e mercados habilitados

Localidades atualmente habilitadas:

- Bauru/SP
- Jaú/SP
- Pederneiras/SP
- Potunduva/SP
- Arealva/SP

Observação importante:

- nem todos os mercados estão disponíveis em todas as cidades
- a disponibilidade efetiva depende da configuração de [lib/regions.ts](lib/regions.ts) e do comportamento de cada scraper

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI / componentes no estilo shadcn
- Cheerio para parsing HTML

## Estrutura do Projeto

```text
app/
  api/search/route.ts        # API principal de busca
  layout.tsx                 # layout global
  page.tsx                   # página inicial
  icon.tsx                   # favicon dinâmico

components/
  search-bar.tsx             # formulário de busca
  market-column.tsx          # coluna de resultados por mercado
  ui/                        # componentes reutilizáveis de interface

lib/
  regions.ts                 # localidades suportadas e contexto regional
  scrapers/
    atacadao.ts              # scraper do Atacadão
    barracao.ts              # scraper do Barracão
    confianca.ts             # scraper do Confiança
    samsclub.ts              # scraper do Sam's Club
    tauste.ts                # scraper do Tauste
    tenda.ts                 # scraper do Tenda
    logger.ts                # logger padronizado
    types.ts                 # tipos compartilhados
  utils.ts

hooks/
styles/
```

## Como Funciona a Busca

O fluxo principal é este:

1. O usuário informa um produto, cidade e estado na página inicial.
2. A interface chama `GET /api/search?q=...&city=...&state=...`.
3. A API valida o termo e resolve a região em [lib/regions.ts](lib/regions.ts).
4. A API verifica cache por `query + cidade + estado`.
5. Se não houver cache válido, apenas os scrapers habilitados para aquela localidade são executados.
6. Os mercados são consultados em paralelo com `Promise.allSettled`.
7. Cada scraper transforma o retorno do mercado em um formato comum.
8. A API agrega os resultados e devolve uma resposta única.
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
- a falha de um mercado não derruba os outros

### Exemplo de Resposta

```json
{
  "query": "nutella 650g",
  "region": {
    "key": "bauru-sp",
    "label": "Bauru, SP",
    "city": "Bauru",
    "state": "SP",
    "isSupported": true,
    "referenceCep": "17014900",
    "enabledMarketIds": ["barracao", "tenda", "samsclub", "tauste", "confianca", "atacadao"]
  },
  "results": [
    {
      "market": {
        "id": "atacadao",
        "name": "Atacadão",
        "color": "#F7941D",
        "url": "https://www.atacadao.com.br",
        "logo": "/markets/atacadao.svg"
      },
      "products": [
        {
          "name": "Nutella Creme de Avelã 1 uni 650g",
          "price": 57.9,
          "priceFormatted": "R$ 57,90",
          "imageUrl": "https://...",
          "productUrl": "https://...",
          "unit": null,
          "bulkPrice": {
            "price": 49.7,
            "minQuantity": 2,
            "priceFormatted": "R$ 49,70",
            "description": "A partir de 2 unidades"
          }
        }
      ],
      "status": "success",
      "searchedAt": "2026-03-23T16:00:00.000Z"
    }
  ],
  "timestamp": "2026-03-23T16:00:00.000Z"
}
```

## Modelo de Dados

Os tipos compartilhados ficam em:

[lib/scrapers/types.ts](lib/scrapers/types.ts)

### `MarketProduct`

Representa um produto normalizado para qualquer mercado:

- `name`
- `price`
- `priceFormatted`
- `imageUrl`
- `productUrl`
- `unit`
- `bulkPrice?`

### `BulkPrice`

Representa um preço unitário promocional condicionado a quantidade mínima:

- `price`
- `minQuantity`
- `priceFormatted`
- `description?`

## Como os Scrapers Funcionam

Cada mercado tem um arquivo próprio em [lib/scrapers](lib/scrapers).

O objetivo de cada scraper é sempre o mesmo:

- buscar produtos no mercado
- extrair nome, imagem, URL e preço
- detectar promoções por quantidade
- devolver tudo no formato `MarketProduct[]`

### Barracão

Arquivo:

[lib/scrapers/barracao.ts](lib/scrapers/barracao.ts)

Características principais:

- usa o catálogo real da loja via `filial/1` e `centro_distribuicao/1`
- suporta contexto regional dentro da arquitetura do projeto
- interpreta preços promocionais a partir de `oferta.preco_oferta`
- monta URLs de produto no formato `/produto/{produto_id}/{slug}`
- usa imagens hospedadas no bucket de assets da plataforma

### Atacadão

Arquivo:

[lib/scrapers/atacadao.ts](lib/scrapers/atacadao.ts)

Características principais:

- usa sessão VTEX com CEP configurado
- tenta busca por APIs VTEX
- interpreta `commertialOffer`, `Teasers` e blocos da página do produto
- faz enriquecimento adicional para detectar preço por quantidade quando necessário
- possui tratamento especial para casos em que a PDP e a busca divergem
- exige bastante cuidado com disponibilidade regional, seller e sessão

### Tenda

Arquivo:

[lib/scrapers/tenda.ts](lib/scrapers/tenda.ts)

Características principais:

- busca em página com forte uso de JavaScript
- tenta extrair JSON embutido no HTML
- faz fallback para parse estrutural da página

### Sam's Club

Arquivo:

[lib/scrapers/samsclub.ts](lib/scrapers/samsclub.ts)

Características principais:

- parsing adaptado ao formato do site do Sam's
- suporte a preço base e preço promocional quando a fonte expõe esse dado

### Tauste

Arquivo:

[lib/scrapers/tauste.ts](lib/scrapers/tauste.ts)

Características principais:

- parse de cards Magento 2
- usa seletores HTML e atributos de preço como fonte principal

### Confiança

Arquivo:

[lib/scrapers/confianca.ts](lib/scrapers/confianca.ts)

Características principais:

- scraper dedicado ao HTML/estrutura do mercado
- normalização para o formato unificado do app

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

A interface principal fica em:

[app/page.tsx](app/page.tsx)

Os principais componentes visuais são:

- [components/search-bar.tsx](components/search-bar.tsx)
- [components/market-column.tsx](components/market-column.tsx)

Recursos da UI:

- busca centralizada no header
- seleção de estado e cidade a partir das localidades suportadas
- Bauru como localidade padrão
- colunas por mercado com layout mais escalável
- destaque do menor preço global
- exibição de preço de atacado em separado
- filtro para produtos indisponíveis

## Instalação

### Requisitos

- Node.js 18 ou superior
- npm

### Passo a Passo

```bash
git clone https://github.com/imduuh/EncontreiBarato.git
cd encontreibarato
npm install
```

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
- expansão do projeto para novas cidades, regiões e mercados

### Fluxo Sugerido

1. crie uma branch para sua alteração
2. implemente a mudança
3. teste manualmente pelo menos uma busca real
4. revise os logs dos scrapers
5. abra um pull request descrevendo o problema e a solução

### Boas Práticas para Contribuir com Scrapers

- preserve o formato de retorno `MarketProduct`
- prefira adicionar fallback em vez de substituir a estratégia anterior
- trate indisponibilidade e preço zerado com cuidado
- registre casos importantes de divergência
- considere que busca, PDP e checkout podem discordar entre si
- lembre que disponibilidade pode variar por cidade, CEP, loja, seller e sessão

## Limites e Observações Importantes

- os mercados podem mudar HTML, endpoints e regras a qualquer momento
- disponibilidade e preço podem variar por cidade, CEP, loja, seller e sessão
- o projeto depende de scraping e integrações não oficiais
- parte dos dados pode ficar temporariamente inconsistente quando o mercado diverge entre busca e PDP
- o cache em memória é local ao processo e não compartilhado entre instâncias

## Roadmap Sugerido

- cache persistente
- testes automatizados para parsers críticos
- observabilidade mais estruturada para falhas de scraper
- identificação mais forte de equivalência entre produtos
- suporte a mais mercados
- suporte a mais regiões e cidades no Brasil

## Licença

Este projeto utiliza a licença presente no repositório.
