/**
 * =============================================================================
 * COMPONENTE DE COLUNA DE MERCADO
 * =============================================================================
 * Exibe os produtos de um mercado em uma coluna com header colorido.
 * Destaca o produto mais barato e exibe precos com desconto por quantidade.
 */

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { MarketResult, MarketProduct } from "@/lib/scrapers/types"
import { ExternalLink, AlertCircle, PackageOpen, Tag } from "lucide-react"

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

interface MarketColumnProps {
  result: MarketResult
  globalMinPrices: Map<string, number>
}

// =============================================================================
// FUNCOES AUXILIARES
// =============================================================================

/**
 * Normaliza o nome do produto para comparacao.
 * Remove acentos, caracteres especiais e converte para minusculas.
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s]/g, "")     // Remove caracteres especiais
    .trim()
}

/**
 * Verifica se o produto tem o menor preco entre todos os mercados.
 * Considera tanto o preco normal quanto o preco por quantidade.
 */
function isProductCheapest(product: MarketProduct, globalMinPrices: Map<string, number>): boolean {
  // Ignorar produtos sem preco
  if (product.price <= 0) return false
  
  const normalized = normalizeProductName(product.name)
  const minPrice = globalMinPrices.get(normalized)
  
  if (minPrice === undefined) return false
  
  // Verificar se o preco normal e o menor
  if (Math.abs(product.price - minPrice) < 0.01) {
    return true
  }
  
  // Verificar se o preco por quantidade e o menor
  if (product.bulkPrice && Math.abs(product.bulkPrice.price - minPrice) < 0.01) {
    return true
  }
  
  return false
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export function MarketColumn({ result, globalMinPrices }: MarketColumnProps) {
  const { market, products, status, error } = result

  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* ===== HEADER DO MERCADO ===== */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: market.color }}
      >
        <span className="font-semibold text-sm text-white drop-shadow-sm">
          {market.name}
        </span>
        <Badge
          variant="secondary"
          className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
        >
          {status === "success"
            ? `${products.length} ${products.length === 1 ? "produto" : "produtos"}`
            : status === "error"
              ? "Erro"
              : "..."}
        </Badge>
      </div>

      {/* ===== CONTEUDO ===== */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-[200px]">
        {/* Estado de erro */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <AlertCircle className="size-5 text-destructive" />
            <span className="text-center">{error || "Nao foi possivel buscar neste mercado"}</span>
          </div>
        )}

        {/* Estado vazio */}
        {status === "success" && products.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-8">
            <PackageOpen className="size-5" />
            <span>Nenhum produto encontrado</span>
          </div>
        )}

        {/* Lista de produtos */}
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

// =============================================================================
// COMPONENTE DE CARD DO PRODUTO
// =============================================================================

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
    <div
      className={`
        flex items-start gap-3 rounded-lg p-3 transition-all
        ${isCheapest
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-muted/50 bg-muted/20"
        }
      `}
    >
      {/* ===== IMAGEM DO PRODUTO ===== */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="size-16 rounded-lg object-contain bg-white flex-shrink-0 border"
          loading="lazy"
          onError={(e) => {
            // Esconder imagem se falhar ao carregar
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
        />
      ) : (
        <div className="size-16 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center border">
          <PackageOpen className="size-6 text-muted-foreground" />
        </div>
      )}

      {/* ===== INFORMACOES DO PRODUTO ===== */}
      <div className="flex-1 min-w-0">
        {/* Nome do produto */}
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
          {product.name}
        </p>

        {/* Precos */}
        <div className="mt-2 space-y-1">
          {/* Preco normal */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-base font-bold ${
                isCheapest && !product.bulkPrice ? "text-primary" : "text-foreground"
              }`}
            >
              {product.priceFormatted}
            </span>
          </div>

          {/* Preco com desconto por quantidade (atacado) */}
          {product.bulkPrice && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="size-3.5 text-primary" />
                <span
                  className={`text-sm font-semibold ${
                    isCheapest ? "text-primary" : "text-primary/80"
                  }`}
                >
                  {product.bulkPrice.priceFormatted}
                </span>
                {quantityLabel && (
                  <span className="text-xs font-medium text-muted-foreground">
                    ({quantityLabel})
                  </span>
                )}
              </div>
              {/* Descricao da promocao (se disponivel) */}
              {showBulkDescription && bulkDescription && (
                <span className="text-xs text-muted-foreground italic ml-5">
                  {bulkDescription}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Link para o site */}
        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-2 transition-colors"
          >
            Ver no site
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// SKELETON PARA LOADING
// =============================================================================

export function MarketColumnSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-[200px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
            <Skeleton className="size-16 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
