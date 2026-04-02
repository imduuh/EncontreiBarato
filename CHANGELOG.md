# Changelog

## [1.2.0] - 2026-04-02

### Adicionado

- Coleta persistente de métricas da API de busca com SQLite
- Dashboard administrativo privado em [app/admin/metrics/page.tsx](app/admin/metrics/page.tsx)
- Proteção da área `/admin` com autenticação básica via variáveis de ambiente
- Métricas de latência com percentis `p50`, `p90`, `p95` e `p99`
- Métricas de throughput com `RPS` em janelas recentes
- Métricas de cache com `hit rate`, `miss rate` e reaproveitamento de requisições em andamento
- Métricas por mercado com sucesso, erro, timeout, latência média e volume médio de produtos
- Persistência local do banco em SQLite fora do versionamento
- Arquivo [.env.example](.env.example) com as variáveis necessárias para a área administrativa

### Alterado

- A API de busca agora registra automaticamente cada execução e cada scraper no banco de métricas
- O projeto agora usa a versão `1.2.0`
- O `.gitignore` foi corrigido e passou a ignorar a pasta local `data/`

### Observações

- As métricas ficam disponíveis apenas para acesso autenticado na área administrativa
- O uptime exibido no dashboard representa o tempo de vida do processo atual da aplicação
- O histórico de métricas é local à instância onde o SQLite está rodando

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
