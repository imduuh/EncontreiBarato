/**
 * =============================================================================
 * PAGINA PRINCIPAL - Encontrei Barato
 * =============================================================================
 * Interface principal do comparador de precos.
 * Permite buscar produtos e comparar precos entre diferentes mercados.
 */

"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { SearchBar } from "@/components/search-bar"
import { MarketColumn, MarketColumnSkeleton } from "@/components/market-column"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { MARKETS, type MarketProduct, type SearchResponse } from "@/lib/scrapers/types"
import { Copy, HeartHandshake, Info, MapPin, ShoppingCart, TrendingDown } from "lucide-react"

const DONATION_PIX_DESCRIPTION = "Doação Encontrei Barato"
const DONATION_PIX_CODE =
  "00020126360014BR.GOV.BCB.PIX0114+55149970408105204000053039865802BR5901N6001C62190515ENCONTREIBARATO63046C03"

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

function computeGlobalMinPrices(data: SearchResponse): Map<string, number> {
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

function isProductAvailable(product: MarketProduct): boolean {
  return product.price > 0 || (product.bulkPrice?.price ?? 0) > 0
}

export default function HomePage() {
  const [data, setData] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [showUnavailableProducts, setShowUnavailableProducts] = useState(true)
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)

  useEffect(() => {
    setIsDonationDialogOpen(true)
  }, [])

  const handleDonationDialogChange = useCallback((open: boolean) => {
    setIsDonationDialogOpen(open)
  }, [])

  const handleCopyPixCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DONATION_PIX_CODE)
      setPixCopied(true)
      window.setTimeout(() => setPixCopied(false), 2500)
    } catch {
      setPixCopied(false)
    }
  }, [])

  const handleSearch = useCallback(async ({
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

      const res = await fetch(`/api/search?${params.toString()}`)

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

  const globalMinPrices = visibleData ? computeGlobalMinPrices(visibleData) : new Map()
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
    visibleData && !visibleData.region.isSupported ? visibleData.region.message : null

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Dialog open={isDonationDialogOpen} onOpenChange={handleDonationDialogChange}>
        <DialogContent className="max-w-lg gap-5 p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500/15 via-background to-primary/10 px-6 py-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
              <HeartHandshake className="size-6" />
            </div>

            <DialogHeader className="gap-3">
              <DialogTitle className="text-xl leading-tight">
                Apoie o Encontrei Barato, se fizer sentido para você.
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Este site é mantido de forma voluntária, sem publicidade e sem gerar
                receita. Se ele te ajuda no dia a dia e você quiser colaborar, qualquer
                apoio será muito bem-vindo, mas isso não é obrigatório.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                QR Code do PIX
              </p>
              <div className="mt-3 flex justify-center">
                <div className="overflow-hidden rounded-2xl border bg-background p-3 shadow-sm">
                  <Image
                    src="/images/pix-doacao-encontrei-barato.png"
                    alt="QR Code do PIX para apoiar o Encontrei Barato"
                    width={220}
                    height={220}
                    className="h-auto w-[220px]"
                    priority
                  />
                </div>
              </div>
              <p className="mt-3 text-center text-sm font-medium text-foreground">
                {DONATION_PIX_DESCRIPTION}
              </p>
              <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
                Se quiser contribuir, basta escanear o QR Code acima no app do seu banco.
              </p>

              <div className="mt-4 rounded-xl border bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Código PIX
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-relaxed text-foreground">
                  {DONATION_PIX_CODE}
                </p>
              </div>
            </div>

            <DialogFooter className="mt-5 -mx-0 -mb-0 rounded-2xl border-0 bg-transparent p-0 sm:justify-end">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCopyPixCode}>
                  <Copy className="size-4" />
                  {pixCopied ? "Código copiado" : "Copiar código PIX"}
                </Button>
                <Button variant="outline" onClick={() => handleDonationDialogChange(false)}>
                  Fechar
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                <ShoppingCart className="size-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight text-foreground">
                  Encontrei Barato
                </h1>
                <p className="text-xs text-muted-foreground">
                  Compare preços entre mercados com contexto por cidade e estado
                </p>
              </div>
            </div>

            <div className="lg:w-[560px]">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <label
              htmlFor="show-unavailable-products"
              className="cursor-pointer text-sm font-medium text-muted-foreground"
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

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {supportedRegionMessage && !isLoading && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {supportedRegionMessage}
          </div>
        )}

        {visibleData && !isLoading && (
          <div className="mb-6 flex flex-col gap-3 border-b pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  Resultados para{" "}
                  <span className="text-primary">"{visibleData.query}"</span>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3.5" />
                <span>{visibleData.region.label}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary/60" />
                {successfulMarkets} de {enabledMarketsCount} mercados consultados
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>{totalProducts} produtos encontrados</span>
              {!visibleData.region.isSupported && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>Região ainda sem cobertura ativa</span>
                </>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
          >
            {MARKETS.map((market) => (
              <MarketColumnSkeleton key={market.id} />
            ))}
          </div>
        )}

        {visibleData && !isLoading && visibleData.results.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
          >
            {visibleData.results.map((result) => (
              <MarketColumn
                key={result.market.id}
                result={result}
                globalMinPrices={globalMinPrices}
              />
            ))}
          </div>
        )}

        {!hasSearched && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
              <ShoppingCart className="size-10 text-primary" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-foreground">
              Busque um produto para consultar
            </h2>
            <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Digite o nome do produto, escolha sua cidade e o estado para consultar os
              mercados compatíveis com a sua região. Em cidades com múltiplas unidades,
              usamos uma loja de referência interna para manter a busca simples e organizada.
            </p>

            <div className="flex max-w-2xl items-start gap-3 rounded-xl border bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-5 flex-shrink-0 text-primary" />
              <p className="text-left leading-relaxed">
                <strong>Dica:</strong> use termos específicos como{" "}
                <span className="font-medium text-foreground">"Nutella 650g"</span> para
                resultados mais precisos.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {MARKETS.map((market) => (
                <div
                  key={market.id}
                  className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium"
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

        {visibleData && !isLoading && visibleData.results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="mb-4 size-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {visibleData.region.isSupported
                ? "Nenhum produto encontrado para essa busca. Tente termos diferentes."
                : visibleData.region.message}
            </p>
          </div>
        )}
      </div>

      <footer className="mt-auto border-t bg-card/50">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p className="font-medium text-foreground">© 2026 EncontreiBarato</p>
            <p>Compare preços com mais rapidez e economize nas suas compras.</p>
          </div>

          <div className="flex flex-col gap-1 text-center sm:text-right">
            <p>
              Desenvolvido por{" "}
              <a
                href="https://instagram.com/iamduuh_"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground transition-colors hover:text-primary"
              >
                Eduardo Mendes
              </a>
            </p>
            <p>
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
