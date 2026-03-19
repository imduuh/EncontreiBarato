/**
 * =============================================================================
 * PAGINA PRINCIPAL - Encontrei Barato
 * =============================================================================
 * Interface principal do comparador de precos.
 * Permite buscar produtos e comparar precos entre diferentes mercados de Bauru.
 */

"use client"

import { useState, useCallback } from "react"
import { SearchBar } from "@/components/search-bar"
import { MarketColumn, MarketColumnSkeleton } from "@/components/market-column"
import { Switch } from "@/components/ui/switch"
import { MARKETS, type SearchResponse, type MarketProduct } from "@/lib/scrapers/types"
import { ShoppingCart, Info, TrendingDown } from "lucide-react"

// =============================================================================
// FUNCOES AUXILIARES
// =============================================================================

/**
 * Normaliza o nome do produto para comparacao entre mercados.
 * Remove acentos, caracteres especiais e converte para minusculas.
 */
function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

/**
 * Calcula o menor preco global para cada produto.
 * Considera tanto o preco normal quanto o preco com desconto por quantidade.
 * 
 * @param data - Resposta da busca com todos os mercados
 * @returns Map com nome normalizado -> menor preco
 */
function computeGlobalMinPrices(data: SearchResponse): Map<string, number> {
  const priceMap = new Map<string, number>()

  // Coletar todos os produtos de todos os mercados
  for (const result of data.results) {
    if (result.status !== "success") continue

    for (const product of result.products) {
      // Ignorar produtos sem preco
      if (product.price <= 0) continue

      const normalized = normalizeForComparison(product.name)
      const existingMin = priceMap.get(normalized)

      // Determinar o menor preco do produto (considerando desconto por quantidade)
      let productMinPrice = product.price
      if (product.bulkPrice && product.bulkPrice.price < productMinPrice) {
        productMinPrice = product.bulkPrice.price
      }

      // Atualizar o menor preco global se necessario
      if (!existingMin || productMinPrice < existingMin) {
        priceMap.set(normalized, productMinPrice)
      }
    }
  }

  return priceMap
}

/**
 * Determina se o produto deve ser tratado como disponivel para exibicao.
 */
function isProductAvailable(product: MarketProduct): boolean {
  return product.price > 0 || (product.bulkPrice?.price ?? 0) > 0
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export default function HomePage() {
  // Estados da aplicacao
  const [data, setData] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [showUnavailableProducts, setShowUnavailableProducts] = useState(true)

  /**
   * Handler de busca - chamado quando o usuario submete uma busca.
   */
  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Erro ao buscar" }))
        throw new Error(errBody.error || `Erro ${res.status}`)
      }

      const json: SearchResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar produtos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const visibleData =
    data && !showUnavailableProducts
      ? {
          ...data,
          results: data.results.map((result) => ({
            ...result,
            products:
              result.status === "success"
                ? result.products.filter(isProductAvailable)
                : result.products,
          })),
        }
      : data

  // Calcular precos minimos globais para destacar o mais barato
  const globalMinPrices = visibleData ? computeGlobalMinPrices(visibleData) : new Map()

  // Estatisticas de resultados
  const totalProducts = visibleData
    ? visibleData.results.reduce(
        (sum, r) => sum + (r.status === "success" ? r.products.length : 0),
        0
      )
    : 0

  const successfulMarkets = visibleData
    ? visibleData.results.filter((r) => r.status === "success").length
    : 0

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Logo e titulo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary shadow-lg shadow-primary/20">
                <ShoppingCart className="size-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight text-foreground">
                  Encontrei Barato
                </h1>
                <p className="text-xs text-muted-foreground">
                  Compare preços entre mercados de Bauru
                </p>
              </div>
            </div>

            {/* Barra de busca */}
            <div className="lg:w-[500px]">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <label
              htmlFor="show-unavailable-products"
              className="text-sm font-medium text-muted-foreground cursor-pointer"
            >
              Mostrar produtos indisponíveis:
            </label>
            <Switch
              id="show-unavailable-products"
              checked={showUnavailableProducts}
              onCheckedChange={setShowUnavailableProducts}
              aria-label="Mostrar produtos indisponiveis"
              className="border-0 shadow-sm data-checked:bg-emerald-500 data-unchecked:bg-red-500"
            />
          </div>
        </div>
      </header>

      {/* ===== CONTEUDO PRINCIPAL ===== */}
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Mensagem de erro */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Header dos resultados */}
        {visibleData && !isLoading && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Resultados para{" "}
                <span className="text-primary">"{visibleData.query}"</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary/60" />
                {successfulMarkets} de {MARKETS.length} mercados consultados
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>{totalProducts} produtos encontrados</span>
            </div>
          </div>
        )}

        {/* Grid de loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {MARKETS.map((market) => (
              <MarketColumnSkeleton key={market.id} />
            ))}
          </div>
        )}

        {/* Grid de resultados */}
        {visibleData && !isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {visibleData.results.map((result) => (
              <MarketColumn
                key={result.market.id}
                result={result}
                globalMinPrices={globalMinPrices}
              />
            ))}
          </div>
        )}

        {/* Estado inicial (sem busca) */}
        {!hasSearched && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
              <ShoppingCart className="size-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Busque um produto para consultar
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Digite o nome de um produto na barra de busca acima.
              Vamos procurar os preços no Tenda Atacado, Sam{"'"}s Club, Tauste,
              Confiança e Atacadão.
            </p>

            {/* Dica de uso */}
            <div className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/50 rounded-xl px-5 py-4 max-w-lg border">
              <Info className="size-5 mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-left leading-relaxed">
                <strong>Dica:</strong> use termos especificos como{" "}
                <span className="font-medium text-foreground">"Nutella 650g"</span>{" "}
                para resultados mais precisos.
              </p>
            </div>

            {/* Mercados disponiveis */}
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {MARKETS.map((market) => (
                <div
                  key={market.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card text-xs font-medium"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: market.color }}
                  />
                  {market.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado sem resultados */}
        {visibleData && !isLoading && totalProducts === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="size-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Nenhum produto encontrado para essa busca. Tente termos diferentes.
            </p>
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="border-t mt-auto bg-card/50">
        <div className="mx-auto max-w-[1600px] px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>EncontreiBarato - Feito para você economizar na sua compra.</p>
          <p>Preços podem variar. Consulte o mercado para confirmação.</p>
        </div>
      </footer>
    </main>
  )
}

// Componente auxiliar para o estado vazio
function PackageOpen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c4.97 0 9-2.24 9-5V9.78c0-1.9-2.5-3.53-6-4.35" />
      <path d="M3 9.78V17c0 2.76 4.03 5 9 5" />
      <path d="M12 22V12" />
      <path d="m21 9.78-9 2.22-9-2.22" />
      <path d="M3 9.78C3 7.02 7.03 5 12 5s9 2.02 9 4.78" />
      <path d="M6 7.54 3 9.78" />
      <path d="m18 7.54 3 2.24" />
      <path d="M6 7.54V2l6 3v5" />
      <path d="M18 7.54V2l-6 3" />
    </svg>
  )
}
