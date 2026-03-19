# Encontrei Barato

Comparador de preços entre mercados, com foco em busca rápida de produtos, consolidação visual por loja e suporte a preços promocionais por quantidade.

O projeto nasceu com um recorte inicial mais regional, mas a proposta do produto é evoluir para um comparador escalável para o Brasil todo, respeitando disponibilidade, CEP, seller e regras específicas de cada mercado.

## Visão Geral

O Encontrei Barato foi construído para resolver um problema simples: pesquisar um produto uma vez e comparar, em poucos segundos, quanto ele custa em diferentes mercados.

Hoje o sistema consulta:

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
- Mantém logs detalhados para diagnóstico dos scrapers
- Trata divergências entre busca, página do produto e disponibilidade regional

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI / componentes no estilo shadcn
- Cheerio para parsing HTML

## Estrutura do projeto

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
  scrapers/
    atacadao.ts              # scraper do Atacadão
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

## Como funciona a busca

O fluxo principal é este:

1. O usuário digita um produto na página inicial.
2. A interface chama `GET /api/search?q=...`.
3. A API valida o termo e verifica o cache.
4. Se não houver cache válido, os scrapers são executados em paralelo.
5. Cada scraper transforma o retorno do mercado em um formato comum.
6. A API agrega os resultados e devolve uma resposta única.
7. A interface renderiza os produtos por mercado e destaca os melhores preços.

## API principal

Endpoint:

```http
GET /api/search?q=nutella%20650g
```

Arquivo:

[app/api/search/route.ts](app/api/search/route.ts)

### Regras da API

- aceita o parâmetro `q`
- exige mínimo de 3 caracteres
- aceita no máximo 100 caracteres
- faz cache em memória por 15 minutos
- executa todos os mercados com `Promise.allSettled`
- a falha de um mercado não derruba os outros

### Exemplo de resposta

```json
{
  "query": "nutella 650g",
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
      "searchedAt": "2026-03-19T16:00:00.000Z"
    }
  ],
  "timestamp": "2026-03-19T16:00:00.000Z"
}
```

## Modelo de dados

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

## Como os scrapers funcionam

Cada mercado tem um arquivo próprio em [lib/scrapers](lib/scrapers).

O objetivo de cada scraper é sempre o mesmo:

- buscar produtos no mercado
- extrair nome, imagem, URL e preço
- detectar promoções por quantidade
- devolver tudo no formato `MarketProduct[]`

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

## Logs e observabilidade

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
- colunas por mercado
- destaque do menor preço global
- exibição de preço de atacado em separado
- filtro para produtos indisponíveis

## Instalação

### Requisitos

- Node.js 18 ou superior
- npm

### Passo a passo

```bash
git clone https://github.com/imduuh/EncontreiBarato.git
cd encontreibarato
npm install
```

### Rodando em desenvolvimento

```bash
npm run dev
```

Depois abra:

[http://localhost:3000](http://localhost:3000)

### Build de produção

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

### Fluxo sugerido

1. crie uma branch para sua alteração
2. implemente a mudança
3. teste manualmente pelo menos uma busca real
4. revise os logs dos scrapers
5. abra um pull request descrevendo o problema e a solução

### Boas práticas para contribuir com scrapers

- preserve o formato de retorno `MarketProduct`
- prefira adicionar fallback em vez de substituir a estratégia anterior
- trate indisponibilidade e preço zerado com cuidado
- registre casos importantes de divergência
- considere que busca, PDP e checkout podem discordar entre si
- lembre que disponibilidade pode variar por CEP, loja, seller e sessão

## Limites e observações importantes

- os mercados podem mudar HTML, endpoints e regras a qualquer momento
- disponibilidade e preço podem variar por CEP, loja, seller e sessão
- o projeto depende de scraping e integrações não oficiais
- parte dos dados pode ficar temporariamente inconsistente quando o mercado diverge entre busca e PDP
- o cache em memória é local ao processo e não compartilhado entre instâncias

## Roadmap sugerido

- cache persistente
- testes automatizados para parsers críticos
- observabilidade mais estruturada para falhas de scraper
- identificação mais forte de equivalência entre produtos
- suporte a mais mercados
- suporte a mais regiões e CEPs no Brasil

## Licença

Este projeto utiliza a licença presente no repositório.
