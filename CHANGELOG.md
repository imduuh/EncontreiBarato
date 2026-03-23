# Changelog

## [1.1.0] - 2026-03-23

### Adicionado

- Novo contexto regional de busca com `cidade` e `estado`
- Camada de localidades em [lib/regions.ts](lib/regions.ts)
- Campo de cidade e seletor de UF na busca da home
- Resposta da API agora inclui informações da região consultada
- [CHANGELOG.md](CHANGELOG.md) para registrar a evolução do projeto
- Novo scraper do Barracão em [lib/scrapers/barracao.ts](lib/scrapers/barracao.ts)
- Barracão habilitado nas localidades suportadas em [lib/regions.ts](lib/regions.ts)

### Alterado

- A busca da API agora considera `query + cidade + estado` no cache
- Os mercados são filtrados antes da execução com base na localidade suportada
- Requisições idênticas em andamento agora são deduplicadas
- Cada scraper passou a aceitar contexto regional
- O scraper do Atacadão agora usa o CEP de referência vindo da região
- O scraper do Barracão passou a usar o catálogo real da loja em `filial/1` e `centro_distribuicao/1`
- A home agora exibe a região da busca e mensagens de cobertura
- Bauru/SP agora inclui o Barracão entre os mercados consultados
- Jaú/SP, Pederneiras/SP, Potunduva/SP e Arealva/SP passaram a aparecer como localidades suportadas para o Barracão

### Performance

- Adicionado timeout por mercado na API para evitar esperas excessivas
- A busca não dispara scrapers para regiões sem cobertura ativa
- Requisições repetidas para a mesma busca e região reaproveitam a mesma execução em andamento

### Observações

- A arquitetura já está pronta para expansão nacional
- A cobertura ativa agora depende da combinação entre cidade e mercados habilitados
- Novas cidades podem ser habilitadas adicionando localidades suportadas e evoluindo os scrapers correspondentes
- Nos testes atuais do Barracão, o mesmo catálogo e os mesmos preços responderam para os CEPs de Bauru, Jaú, Pederneiras e Arealva

### Release

- Bump de versão do projeto para `1.1.0`
