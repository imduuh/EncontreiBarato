import { Info, PackageOpen, ShoppingCart } from "lucide-react"
import { MarketColumn, MarketColumnSkeleton } from "@/components/market-column"
import { MARKETS, type SearchResponse } from "@/lib/scrapers/types"

type SearchResultsViewProps = {
  data: SearchResponse | null
  isLoading: boolean
  hasSearched: boolean
  globalMinPrices: Map<string, number>
  supportedRegionMessage: string | null
}

export function SearchResultsView({
  data,
  isLoading,
  hasSearched,
  globalMinPrices,
  supportedRegionMessage,
}: SearchResultsViewProps) {
  return (
    <>
      {supportedRegionMessage && !isLoading && (
        <div className="mb-6 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-sm">
          {supportedRegionMessage}
        </div>
      )}

      {isLoading && (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
        >
          {MARKETS.map((market) => (
            <MarketColumnSkeleton key={market.id} />
          ))}
        </div>
      )}

      {data && !isLoading && data.results.length > 0 && (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
        >
          {data.results.map((result) => (
            <MarketColumn
              key={result.market.id}
              result={result}
              globalMinPrices={globalMinPrices}
            />
          ))}
        </div>
      )}

      {!hasSearched && !isLoading && (
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/45 px-6 py-12 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/10 via-primary/0 to-primary/10" />

          <div className="relative flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary/22 via-primary/10 to-white/3 shadow-[0_20px_50px_-24px_rgba(52,211,153,0.45)]">
              <ShoppingCart className="size-10 text-primary" />
            </div>

            <h2 className="mb-3 text-3xl font-semibold tracking-tight text-white">
              {"Pesquise um produto para começar"}
            </h2>

            <p className="mb-8 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              {"A partir da sua cidade e estado, a busca consulta os mercados compatíveis com a sua região e organiza os resultados para você comparar com mais clareza."}
            </p>

            <div className="flex max-w-2xl items-start gap-3 rounded-[1.5rem] border border-primary/15 bg-primary/8 px-5 py-4 text-sm text-slate-300">
              <Info className="mt-0.5 size-5 flex-shrink-0 text-primary" />
              <p className="text-left leading-relaxed">
                <strong className="text-white">Dica:</strong> {" use termos mais específicos,"}
                como <span className="font-medium text-white"> "Nutella 650g"</span>, para melhorar a
                {" precisão da comparação."}
              </p>
            </div>
          </div>
        </section>
      )}

      {data && !isLoading && data.results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-slate-950/45 px-6 py-12 text-center shadow-sm backdrop-blur">
          <PackageOpen className="mb-4 size-12 text-slate-500" />
          <p className="text-sm text-slate-300">
            {data.region.isSupported
              ? "Nenhum produto encontrado para essa busca. Tente termos diferentes."
              : data.region.message}
          </p>
        </div>
      )}
    </>
  )
}
