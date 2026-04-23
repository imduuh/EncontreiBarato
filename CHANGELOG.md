# Changelog

## [1.5.0] - 2026-04-23

### Adicionado

- Novo filtro de ordenação dos produtos na home, com opções de:
  - menor preço
  - maior preço
  - nome A-Z
  - nome Z-A

### Alterado

- A interface da home recebeu uma nova direção visual:
  - visual mais escuro e moderno
  - cards dos mercados redesenhados
  - bloco de comparação com nova hierarquia visual
  - modal de doação alinhado ao novo tema
- README e CHANGELOG foram revisados e alinhados com a versão `1.5.0`

## [1.4.0] - 2026-04-06

### Adicionado

- Novo scraper do San Michel em [lib/scrapers/sanmichel.ts](./lib/scrapers/sanmichel.ts)
- Base compartilhada para integrações VIPCommerce em [lib/scrapers/vipcommerce.ts](./lib/scrapers/vipcommerce.ts)

### Alterado

- A home foi reorganizada em componentes dedicados:
  - [components/home/search-controller.tsx](./components/home/search-controller.tsx)
  - [components/home/search-results-view.tsx](./components/home/search-results-view.tsx)
  - [components/home/price-comparison.tsx](./components/home/price-comparison.tsx)
  - [components/home/donation-modal.tsx](./components/home/donation-modal.tsx)
- Barracão e San Michel passaram a compartilhar a mesma infraestrutura de autenticação, sessão, resolução de filial e busca paginada da VIPCommerce
- O cache da API passou a usar limite real de 100 entradas com política de evicção previsível
- O parser de preço do San Michel foi ajustado para normalizar corretamente valores retornados em centavos
- README reestruturado com foco em onboarding, execução local, variáveis de ambiente e operação do projeto
- Documentação dos scrapers movida para arquivos dedicados em [docs/scrapers](./docs/scrapers)
- O projeto passou a usar a versão `1.4.0`

## [1.3.0] - 2026-04-04

### Adicionado

- Novo scraper do Oba Hortifruti em [lib/scrapers/oba.ts](./lib/scrapers/oba.ts)
- Base com 72 localidades do Oba Delivery em [lib/oba-locations.ts](./lib/oba-locations.ts)
- Suporte a `locationKey` na interface e na API para diferenciar lojas da mesma cidade
- Integração do Oba na lista oficial de mercados em [lib/scrapers/types.ts](./lib/scrapers/types.ts)

### Alterado

- A API de busca passou a resolver a região por cidade e a usar uma loja de referência interna quando houver várias unidades
- A chave de cache continua baseada no identificador técnico da cidade selecionada
- [lib/regions.ts](./lib/regions.ts) passou a agrupar as 72 localidades do Oba por cidade para evitar poluição visual
- O README foi atualizado para refletir a nova cobertura regional e o novo scraper

## [1.2.0] - 2026-04-02

### Adicionado

- Coleta persistente de métricas da API de busca com SQLite
- Dashboard administrativo privado em [app/admin/metrics/page.tsx](./app/admin/metrics/page.tsx)
- Proteção da área `/admin` com autenticação básica via variáveis de ambiente
- Métricas de latência com percentis `p50`, `p90`, `p95` e `p99`
- Métricas de throughput com `RPS` em janelas recentes
- Métricas de cache com `hit rate`, `miss rate` e reaproveitamento de requisições em andamento
- Métricas por mercado com sucesso, erro, timeout, latência média e volume médio de produtos
- Persistência local do banco em SQLite fora do versionamento
- Arquivo [.env.example](./.env.example) com as variáveis necessárias para a área administrativa

### Alterado

- A API de busca agora registra automaticamente cada execução e cada scraper no banco de métricas
- O projeto passou a usar a versão `1.2.0`
- O `.gitignore` foi ajustado para ignorar a pasta local `data/`

### Observações

- As métricas ficam disponíveis apenas para acesso autenticado na área administrativa
- O uptime exibido no dashboard representa o tempo de vida do processo atual da aplicação
- O histórico de métricas é local à instância onde o SQLite está rodando

## [1.1.0] - 2026-03-23

### Adicionado

- Novo contexto regional de busca com `cidade` e `estado`
- Camada de localidades em [lib/regions.ts](./lib/regions.ts)
- Campo de cidade e seletor de UF na busca da home
- Resposta da API agora inclui informações da região consultada
- [CHANGELOG.md](./CHANGELOG.md) para registrar a evolução do projeto
- Novo scraper do Barracão em [lib/scrapers/barracao.ts](./lib/scrapers/barracao.ts)
- Barracão habilitado nas localidades suportadas em [lib/regions.ts](./lib/regions.ts)

### Alterado

- A busca da API passou a considerar `query + cidade + estado` no cache
- Os mercados passaram a ser filtrados antes da execução com base na localidade suportada
- Requisições idênticas em andamento passaram a ser deduplicadas
- Cada scraper passou a aceitar contexto regional
- O scraper do Atacadão passou a usar o CEP de referência vindo da região
- A home passou a exibir a região da busca e mensagens de cobertura
- Bauru/SP passou a incluir o Barracão entre os mercados consultados

### Performance

- Adicionado timeout por mercado na API para evitar esperas excessivas
- A busca não dispara scrapers para regiões sem cobertura ativa
- Requisições repetidas para a mesma busca e região reaproveitam a mesma execução em andamento
