import { getMetricsDashboard } from "@/lib/metrics/service"
import { Clock3, Gauge, ShieldCheck, TimerReset, TrendingUp } from "lucide-react"

function formatMs(value: number) {
  return `${Math.round(value)} ms`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function formatRps(value: number) {
  return value.toFixed(3)
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const dynamic = "force-dynamic"

export default function MetricsPage() {
  const metrics = getMetricsDashboard()

  const cards = [
    {
      title: "Latência Média",
      value: formatMs(metrics.summary.averageLatencyMs),
      detail: `p95 ${formatMs(metrics.summary.p95)} | p99 ${formatMs(metrics.summary.p99)}`,
      icon: Gauge,
    },
    {
      title: "Cache Hit Rate",
      value: formatPercent(metrics.summary.cacheHitRate),
      detail: `${metrics.summary.totalCacheHits} hits | ${metrics.summary.totalCacheMisses} misses`,
      icon: TrendingUp,
    },
    {
      title: "RPS",
      value: formatRps(metrics.summary.rpsLast5Minutes),
      detail: `últimos 5 min | ${formatRps(metrics.summary.rpsLast60Minutes)} em 60 min`,
      icon: Clock3,
    },
    {
      title: "Uptime do Processo",
      value: formatUptime(metrics.uptimeSeconds),
      detail: `gerado em ${new Date(metrics.generatedAt).toLocaleString("pt-BR")}`,
      icon: TimerReset,
    },
    {
      title: "Taxa de Sucesso",
      value: formatPercent(metrics.summary.requestSuccessRate),
      detail: `${metrics.summary.successfulRequests} de ${metrics.summary.totalRequests} buscas`,
      icon: ShieldCheck,
    },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium text-primary">Admin</p>
          <h1 className="text-3xl font-bold text-foreground">Métricas da Aplicação</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Painel com métricas de latência, percentis, cache, throughput,
            saúde dos scrapers e uso recente da API de busca.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <article
                key={card.title}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{card.detail}</p>
              </article>
            )
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Resumo Geral</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricRow label="Total de buscas" value={String(metrics.summary.totalRequests)} />
              <MetricRow
                label="Regiões sem suporte"
                value={String(metrics.summary.unsupportedRegionRequests)}
              />
              <MetricRow label="Latência mínima" value={formatMs(metrics.summary.minLatencyMs)} />
              <MetricRow label="Latência máxima" value={formatMs(metrics.summary.maxLatencyMs)} />
              <MetricRow label="p50" value={formatMs(metrics.summary.p50)} />
              <MetricRow label="p90" value={formatMs(metrics.summary.p90)} />
              <MetricRow label="p95" value={formatMs(metrics.summary.p95)} />
              <MetricRow label="p99" value={formatMs(metrics.summary.p99)} />
              <MetricRow
                label="Reuso de busca em andamento"
                value={String(metrics.summary.totalInFlightReused)}
              />
              <MetricRow
                label="Cache miss rate"
                value={formatPercent(metrics.summary.cacheMissRate)}
              />
            </div>
          </article>

          <article className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Últimas Buscas</h2>
            <div className="mt-4 space-y-3">
              {metrics.latestRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma métrica registrada ainda.
                </p>
              )}
              {metrics.latestRequests.map((request, index) => (
                <div
                  key={`${request.createdAt}-${index}`}
                  className="rounded-xl border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{request.query}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatMs(request.latencyMs)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{request.regionLabel}</span>
                    <span>•</span>
                    <span>{request.totalProducts} produtos</span>
                    <span>•</span>
                    <span>{request.status}</span>
                    {request.cacheHit && (
                      <>
                        <span>•</span>
                        <span>cache hit</span>
                      </>
                    )}
                    {request.inFlightReused && (
                      <>
                        <span>•</span>
                        <span>requisição reaproveitada</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Mercados</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Mercado</th>
                  <th className="px-3 py-2 font-medium">Execuções</th>
                  <th className="px-3 py-2 font-medium">Sucesso</th>
                  <th className="px-3 py-2 font-medium">Erro</th>
                  <th className="px-3 py-2 font-medium">Timeout</th>
                  <th className="px-3 py-2 font-medium">Latência média</th>
                  <th className="px-3 py-2 font-medium">p95</th>
                  <th className="px-3 py-2 font-medium">p99</th>
                  <th className="px-3 py-2 font-medium">Produtos médios</th>
                </tr>
              </thead>
              <tbody>
                {metrics.scraperStats.map((market) => (
                  <tr key={market.marketId} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium text-foreground">{market.marketName}</td>
                    <td className="px-3 py-3">{market.totalRuns}</td>
                    <td className="px-3 py-3">{formatPercent(market.successRate)}</td>
                    <td className="px-3 py-3">{formatPercent(market.errorRate)}</td>
                    <td className="px-3 py-3">{formatPercent(market.timeoutRate)}</td>
                    <td className="px-3 py-3">{formatMs(market.averageLatencyMs)}</td>
                    <td className="px-3 py-3">{formatMs(market.p95)}</td>
                    <td className="px-3 py-3">{formatMs(market.p99)}</td>
                    <td className="px-3 py-3">{market.averageProducts.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/25 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  )
}
