# Tenda Atacado

## Visão geral

O Tenda combina renderização forte em JavaScript com dados embutidos na página, então o scraper trabalha com múltiplos caminhos de extração.

## Estratégia

- tenta ler JSON embutido no HTML
- faz fallback para parse estrutural da página
- normaliza preço, imagem, link e disponibilidade

## Pontos de atenção

- a busca depende bastante da estrutura renderizada
- mudanças no storefront podem exigir ajuste rápido nos seletores

## Arquivo principal

- `lib/scrapers/tenda.ts`
