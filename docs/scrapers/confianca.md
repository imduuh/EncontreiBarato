# Confiança

## Visão geral

O scraper do Confiança trabalha sobre páginas e dados expostos pelo Oracle Commerce Cloud.

## Estratégia

- busca o termo no e-commerce
- interpreta os cards da listagem
- normaliza nome, preço, imagem e link

## Pontos de atenção

- a estrutura do HTML pode variar com ajustes do storefront
- a extração depende de preços disponíveis na listagem

## Arquivo principal

- `lib/scrapers/confianca.ts`
