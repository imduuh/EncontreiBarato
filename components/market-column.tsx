import { AlertCircle, ExternalLink, PackageOpen, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { MarketProduct, MarketResult } from "@/lib/scrapers/types"

interface MarketColumnProps {
  result: MarketResult
  globalMinPrices: Map<string, number>
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

function isProductCheapest(product: MarketProduct, globalMinPrices: Map<string, number>): boolean {
  if (product.price <= 0) return false

  const normalized = normalizeProductName(product.name)
  const minPrice = globalMinPrices.get(normalized)

  if (minPrice === undefined) return false
  if (Math.abs(product.price - minPrice) < 0.01) return true
  if (product.bulkPrice && Math.abs(product.bulkPrice.price - minPrice) < 0.01) return true

  return false
}

export function MarketColumn({ result, globalMinPrices }: MarketColumnProps) {
  const { market, products, status, error } = result

  return (
    <div className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.9)] backdrop-blur transition-transform duration-200 hover:-translate-y-1">
      <div
        className="relative overflow-hidden px-5 py-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${market.color}, color-mix(in srgb, ${market.color} 58%, #020617))`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_36%)]" />

        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold tracking-tight">{market.name}</p>
            <p className="mt-1 text-xs text-white/80">Resultados do mercado para esta busca</p>
          </div>

          <Badge
            variant="secondary"
            className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/18"
          >
            {status === "success"
              ? `${products.length} ${products.length === 1 ? "produto" : "produtos"}`
              : status === "error"
                ? "Erro"
                : "..."}
          </Badge>
        </div>
      </div>

      <div className="flex min-h-[240px] flex-1 flex-col gap-3 p-4">
        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-300">
            <AlertCircle className="size-5 text-red-300" />
            <span>{error || "Não foi possível buscar neste mercado."}</span>
          </div>
        )}

        {status === "success" && products.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-10 text-sm text-slate-300">
            <PackageOpen className="size-5" />
            <span>Nenhum produto encontrado</span>
          </div>
        )}

        {status === "success" &&
          products.map((product, idx) => (
            <ProductCard
              key={`${product.name}-${idx}`}
              product={product}
              isCheapest={isProductCheapest(product, globalMinPrices)}
            />
          ))}
      </div>
    </div>
  )
}

interface ProductCardProps {
  product: MarketProduct
  isCheapest: boolean
}

function ProductCard({ product, isCheapest }: ProductCardProps) {
  const bulkDescription = product.bulkPrice?.description?.trim()
  const normalizedBulkDescription = bulkDescription?.toLowerCase()
  const quantityLabel = product.bulkPrice
    ? `${product.bulkPrice.minQuantity}+ unidades`
    : null
  const showBulkDescription =
    Boolean(bulkDescription) &&
    normalizedBulkDescription !== `a partir de ${product.bulkPrice?.minQuantity} unidades` &&
    normalizedBulkDescription !== `a partir de ${product.bulkPrice?.minQuantity} unid.` &&
    normalizedBulkDescription !== `${product.bulkPrice?.minQuantity}+ unidades`

  return (
    <article
      className={`rounded-[1.4rem] border p-3 transition-colors ${
        isCheapest
          ? "border-primary/25 bg-primary/10 shadow-[0_18px_45px_-30px_rgba(52,211,153,0.8)]"
          : "border-white/8 bg-white/5 hover:bg-white/7"
      }`}
    >
      <div className="flex items-start gap-3">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-20 rounded-2xl border border-white/10 bg-white object-contain p-1.5"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <PackageOpen className="size-6 text-slate-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-100">
              {product.name}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{product.priceFormatted}</span>
            </div>

            {product.bulkPrice && (
              <div className="rounded-xl border border-primary/15 bg-primary/8 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="size-3.5 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {product.bulkPrice.priceFormatted}
                  </span>
                  {quantityLabel && (
                    <span className="text-xs font-medium text-slate-400">({quantityLabel})</span>
                  )}
                </div>

                {showBulkDescription && bulkDescription && (
                  <p className="mt-1 text-xs leading-5 text-slate-400">{bulkDescription}</p>
                )}
              </div>
            )}
          </div>

          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-primary"
            >
              Ver no site
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

export function MarketColumnSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.9)] backdrop-blur">
      <div className="flex items-center justify-between bg-white/6 px-5 py-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="flex min-h-[240px] flex-col gap-3 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-[1.4rem] border border-white/8 bg-white/5 p-3"
          >
            <Skeleton className="size-20 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
