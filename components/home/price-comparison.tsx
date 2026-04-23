import { MapPin, TrendingDown } from "lucide-react"
import type { MarketProduct, SearchResponse } from "@/lib/scrapers/types"

export function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

export function isProductAvailable(product: MarketProduct): boolean {
  return product.price > 0 || (product.bulkPrice?.price ?? 0) > 0
}

export function computeGlobalMinPrices(data: SearchResponse): Map<string, number> {
  const priceMap = new Map<string, number>()

  for (const result of data.results) {
    if (result.status !== "success") continue

    for (const product of result.products) {
      if (product.price <= 0) continue

      const normalized = normalizeForComparison(product.name)
      const existingMin = priceMap.get(normalized)

      let productMinPrice = product.price
      if (product.bulkPrice && product.bulkPrice.price < productMinPrice) {
        productMinPrice = product.bulkPrice.price
      }

      if (!existingMin || productMinPrice < existingMin) {
        priceMap.set(normalized, productMinPrice)
      }
    }
  }

  return priceMap
}

type PriceComparisonProps = {
  data: SearchResponse
  totalProducts: number
  successfulMarkets: number
  enabledMarketsCount: number
}

export function PriceComparison({
  data,
  totalProducts,
  successfulMarkets,
  enabledMarketsCount,
}: PriceComparisonProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <TrendingDown className="size-4" />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-100">
              Comparando resultados para <span className="text-primary">"{data.query}"</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {"A busca considera a cobertura real dos mercados habilitados para a sua região."}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-medium text-slate-200">
          <MapPin className="size-3.5 text-primary" />
          <span>{data.region.label}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Mercados" value={`${successfulMarkets}`} detail={`/ ${enabledMarketsCount}`} />
        <MetricCard label="Produtos" value={`${totalProducts}`} />
        <MetricCard label="Cobertura" value={data.region.isSupported ? "Ativa" : "Em expansão"} compact />
      </div>

      {!data.region.isSupported && (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {"Esta região ainda não tem cobertura completa, então alguns mercados podem não responder nesta busca."}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string
  value: string
  detail?: string
  compact?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-semibold text-slate-50 ${compact ? "text-sm" : "text-2xl"}`}>
        {value}
        {detail && <span className="ml-1 text-sm font-medium text-slate-400">{detail}</span>}
      </p>
    </div>
  )
}
