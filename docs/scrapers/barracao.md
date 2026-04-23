# Barracão

## Visão geral

O Barracão roda sobre a plataforma VIPCommerce e usa sessão autenticada da loja para pesquisar o catálogo.

## Estratégia

- resolve a organização pelo domínio
- autentica a loja e abre uma sessão
- consulta o catálogo da storefront validada
- interpreta preço base e preço promocional

## Cobertura atual

- Bauru/SP
- Jaú/SP
- Pederneiras/SP
- Potunduva/SP
- Arealva/SP

## Pontos de atenção

- a plataforma usa conceitos de filial e centro de distribuição
- imagens e links de produto seguem padrões próprios da VIPCommerce

## Arquivo principal

- `lib/scrapers/barracao.ts`
