# Oba Hortifruti

## Visão geral

O Oba usa VTEX com regionalização por `regionId`. A interface mostra apenas cidade e estado, mas internamente o projeto resolve uma loja de referência.

## Estratégia

- resolve a região pela API de `regions`
- monta o contexto regional da cidade escolhida
- envia a busca pelo `intelligent-search`
- normaliza os produtos retornados

## Cobertura atual

- 72 localidades internas validadas
- interface agrupada por cidade para evitar poluição visual

## Pontos de atenção

- algumas cidades têm múltiplas unidades
- o seller retornado pode variar entre lojas da mesma cidade
- a cobertura é validada cidade a cidade

## Arquivos principais

- `lib/scrapers/oba.ts`
- `lib/oba-locations.ts`
- `lib/regions.ts`
