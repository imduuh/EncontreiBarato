# Changelog

## [1.1.0] - 2026-03-23

### Adicionado

- Novo contexto regional de busca com `cidade` e `estado`
- Camada de localidade em [lib/regions.ts](lib/regions.ts)
- Campo de cidade e seletor de UF na busca da home
- Resposta da API agora inclui informacoes da regiao consultada
- `CHANGELOG.md` para registrar as evolucoes do projeto
- Novo scraper do Barracao em [lib/scrapers/barracao.ts](lib/scrapers/barracao.ts)
- Barracao habilitado nas localidades suportadas em [lib/regions.ts](lib/regions.ts)

### Alterado

- A busca da API agora considera `query + cidade + estado` no cache
- Mercados sao filtrados antes da execucao com base na localidade suportada
- Requests identicas em andamento agora sao deduplicadas
- Cada scraper passou a aceitar contexto regional
- O scraper do Atacadao agora usa o CEP de referencia vindo da regiao
- O scraper do Barracao passou a usar o catalogo real da loja em `filial/1` e `centro_distribuicao/1`
- A home agora exibe a regiao da busca e mensagens de cobertura
- Bauru/SP agora inclui o Barracao entre os mercados consultados
- Jau/SP, Pederneiras/SP, Potunduva/SP e Arealva/SP passaram a aparecer como localidades suportadas para o Barracao

### Performance

- Adicionado timeout por mercado na API para evitar esperas excessivas
- Busca nao dispara scrapers para regioes sem cobertura ativa
- Requests repetidas para a mesma busca/regiao reaproveitam a mesma execucao em andamento

### Observacoes

- A arquitetura ja esta pronta para expansao nacional
- A cobertura ativa agora depende da combinacao entre cidade e mercados habilitados
- Novas cidades podem ser habilitadas adicionando localidades suportadas e evoluindo os scrapers correspondentes
- Nos testes atuais do Barracao, o mesmo catalogo e os mesmos precos responderam para os CEPs de Bauru, Jau, Pederneiras e Arealva

### Release

- Bump de versao do projeto para `1.1.0`
