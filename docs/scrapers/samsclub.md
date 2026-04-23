# Sam's Club

## Visão geral

O scraper do Sam's Club adapta a busca ao formato de listagem disponível no site brasileiro.

## Estratégia

- consulta o resultado de busca
- interpreta os produtos visíveis na listagem
- extrai preço, imagem, nome e link

## Pontos de atenção

- a disponibilidade pode variar por contexto comercial
- algumas informações de preço dependem do retorno da própria listagem

## Arquivo principal

- `lib/scrapers/samsclub.ts`
