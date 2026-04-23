# Tauste

## Visão geral

O scraper do Tauste trabalha sobre páginas Magento 2 e extrai os produtos diretamente dos cards de listagem.

## Estratégia

- consulta a busca do mercado
- interpreta atributos e seletores do Magento
- normaliza preço, imagem, link e unidade

## Pontos de atenção

- mudanças de tema ou markup do Magento podem afetar os seletores
- a qualidade da listagem impacta diretamente a extração

## Arquivo principal

- `lib/scrapers/tauste.ts`
