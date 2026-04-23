"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowUpRight, SearchCode, ShoppingCart } from "lucide-react"
import { DonationModal } from "@/components/home/donation-modal"
import {
  PriceComparison,
  computeGlobalMinPrices,
  isProductAvailable,
} from "@/components/home/price-comparison"
import { SearchResultsView } from "@/components/home/search-results-view"
import { SearchBar } from "@/components/search-bar"
import { Switch } from "@/components/ui/switch"
import { MARKETS, type MarketProduct, type SearchResponse } from "@/lib/scrapers/types"

type ProductSortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc"

export function SearchController() {
  const [data, setData] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [showUnavailableProducts, setShowUnavailableProducts] = useState(true)
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(true)
  const [sortOption, setSortOption] = useState<ProductSortOption>("price-asc")

  const handleSearch = useCallback(
    async ({
      query,
      city,
      state,
      locationKey,
    }: {
      query: string
      city: string
      state: string
      locationKey: string
    }) => {
      setIsLoading(true)
      setError(null)
      setHasSearched(true)

      try {
        const params = new URLSearchParams({
          q: query,
          city,
          state,
          locationKey,
        })

        const response = await fetch(`/api/search?${params.toString()}`)
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ error: "Erro ao buscar" }))
          throw new Error(errBody.error || `Erro ${response.status}`)
        }

        const json: SearchResponse = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao buscar produtos")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const visibleData = useMemo(() => {
    if (!data || showUnavailableProducts) {
      return sortResults(data, sortOption)
    }

    return sortResults(
      {
      ...data,
      results: data.results.map((result) => ({
        ...result,
        products:
          result.status === "success"
            ? result.products.filter(isProductAvailable)
            : result.products,
      })),
      },
      sortOption
    )
  }, [data, showUnavailableProducts, sortOption])

  const globalMinPrices = useMemo(
    () => (visibleData ? computeGlobalMinPrices(visibleData) : new Map<string, number>()),
    [visibleData]
  )

  const totalProducts = visibleData
    ? visibleData.results.reduce(
        (sum, item) => sum + (item.status === "success" ? item.products.length : 0),
        0
      )
    : 0

  const successfulMarkets = visibleData
    ? visibleData.results.filter((item) => item.status === "success").length
    : 0

  const enabledMarketsCount = visibleData?.region.enabledMarketIds.length ?? MARKETS.length
  const supportedRegionMessage =
    visibleData && !visibleData.region.isSupported ? (visibleData.region.message ?? null) : null

  return (
    <main className="relative min-h-screen overflow-hidden">
      <DonationModal open={isDonationDialogOpen} onOpenChange={setIsDonationDialogOpen} />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)]" />

      <header className="sticky top-0 z-50 border-b border-white/8 bg-slate-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/55">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-primary to-emerald-400 shadow-[0_18px_44px_-18px_rgba(52,211,153,0.8)]">
              <ShoppingCart className="size-5 text-slate-950" />
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                Encontrei Barato
              </h1>
              <p className="text-xs text-slate-400">
                {"Compare preços entre mercados da sua região"}
              </p>
            </div>
          </div>

          <a
            href="https://instagram.com/iamduuh_"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-primary/30 hover:text-white md:inline-flex"
          >
            Eduardo Mendes
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-8">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-slate-950/55 px-5 py-10 shadow-[0_40px_120px_-52px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:px-8 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_28%)]" />

          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <SearchCode className="size-3.5" />
              {"O foco aqui é buscar e comparar rápido"}
            </div>

            <h2 className="mt-6 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {"Busque primeiro. Compare depois. Decida mais rápido."}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {"Digite o produto, escolha sua cidade e o estado e veja quais mercados da sua região têm os melhores valores."}
            </p>

            <div className="mt-8 w-full max-w-4xl">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                {MARKETS.length} mercados integrados
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                Busca por cidade e estado
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                {"Comparação em uma única tela"}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">
            {hasSearched
              ? "Os resultados abaixo refletem os mercados disponíveis para a sua região."
              : "Use a busca acima para consultar preços na sua região."}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm shadow-sm">
              <label
                htmlFor="product-sort"
                className="cursor-pointer font-medium text-slate-200"
              >
                Ordenar por
              </label>
              <select
                id="product-sort"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as ProductSortOption)}
                className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-sm text-slate-100 outline-none"
                aria-label="Ordenar produtos"
              >
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name-asc">Nome A-Z</option>
                <option value="name-desc">Nome Z-A</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm shadow-sm">
              <label
                htmlFor="show-unavailable-products"
                className="cursor-pointer font-medium text-slate-200"
              >
                Mostrar indisponíveis
              </label>
              <Switch
                id="show-unavailable-products"
                checked={showUnavailableProducts}
                onCheckedChange={setShowUnavailableProducts}
                aria-label="Mostrar produtos indisponíveis"
                className="border-0 shadow-sm data-checked:bg-emerald-500 data-unchecked:bg-slate-600"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          {error && (
            <div className="mb-6 rounded-[1.5rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200 shadow-sm">
              {error}
            </div>
          )}

          {visibleData && !isLoading && (
            <PriceComparison
              data={visibleData}
              totalProducts={totalProducts}
              successfulMarkets={successfulMarkets}
              enabledMarketsCount={enabledMarketsCount}
            />
          )}

          <SearchResultsView
            data={visibleData}
            isLoading={isLoading}
            hasSearched={hasSearched}
            globalMinPrices={globalMinPrices}
            supportedRegionMessage={supportedRegionMessage}
          />
        </div>
      </div>

      <footer className="mt-auto border-t border-white/8 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-slate-100">© 2026 Encontrei Barato</p>
            <p className="mt-1">{"Compare preços com mais rapidez e economize no dia a dia."}</p>
          </div>

          <div className="text-left md:text-right">
            <p>
              Projeto independente desenvolvido por{" "}
              <a
                href="https://instagram.com/iamduuh_"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-100 transition-colors hover:text-primary"
              >
                Eduardo Mendes
              </a>
            </p>
            <p className="mt-1">
              Instagram:{" "}
              <a
                href="https://instagram.com/iamduuh_"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                @iamduuh_
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}

function sortResults(data: SearchResponse | null, sortOption: ProductSortOption): SearchResponse | null {
  if (!data) return null

  return {
    ...data,
    results: data.results.map((result) => ({
      ...result,
      products:
        result.status === "success"
          ? [...result.products].sort((a, b) => compareProducts(a, b, sortOption))
          : result.products,
    })),
  }
}

function compareProducts(a: MarketProduct, b: MarketProduct, sortOption: ProductSortOption) {
  switch (sortOption) {
    case "name-asc":
      return a.name.localeCompare(b.name, "pt-BR")
    case "name-desc":
      return b.name.localeCompare(a.name, "pt-BR")
    case "price-desc":
      return getDescendingSortablePrice(b) - getDescendingSortablePrice(a)
    case "price-asc":
    default:
      return getSortablePrice(a) - getSortablePrice(b)
  }
}

function getSortablePrice(product: MarketProduct) {
  if (product.price <= 0) return Number.POSITIVE_INFINITY
  return Math.min(product.price, product.bulkPrice?.price ?? product.price)
}

function getDescendingSortablePrice(product: MarketProduct) {
  if (product.price <= 0) return Number.NEGATIVE_INFINITY
  return Math.max(product.price, product.bulkPrice?.price ?? product.price)
}
