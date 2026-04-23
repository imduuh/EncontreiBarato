# Atacadão

## Visão geral

O scraper do Atacadão usa endpoints e páginas da VTEX para buscar produtos com contexto regional.

## Estratégia

- resolve a sessão com CEP de referência
- consulta listagens de busca da VTEX
- interpreta preço base, disponibilidade e seller
- usa enriquecimento adicional quando necessário para promoções por quantidade

## Pontos de atenção

- forte dependência de sessão regional
- seller e disponibilidade podem mudar por cidade
- promoções por atacado nem sempre aparecem completas na primeira resposta

## Arquivo principal

- `lib/scrapers/atacadao.ts`
