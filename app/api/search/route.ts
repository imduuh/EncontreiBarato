/**
 * =============================================================================
 * API DE BUSCA DE PRODUTOS
 * =============================================================================
 *
 * Endpoint: GET /api/search?q={termo}&city={cidade}&state={uf}
 *
 * Esta API busca produtos em todos os mercados suportados para a localidade
 * informada. Os resultados sao cacheados por 15 minutos e requests iguais em
 * andamento sao deduplicadas para reduzir tempo de espera e carga desnecessaria.
 */

import { NextRequest, NextResponse } from "next/server"
import { resolveSearchRegion } from "@/lib/regions"
import { scrapeBarracao } from "@/lib/scrapers/barracao"
import { scrapeTenda } from "@/lib/scrapers/tenda"
import { scrapeSamsClub } from "@/lib/scrapers/samsclub"
import { scrapeTauste } from "@/lib/scrapers/tauste"
import { scrapeConfianca } from "@/lib/scrapers/confianca"
import { scrapeAtacadao } from "@/lib/scrapers/atacadao"
import { recordSearchMetric, summarizeSearchResults, type ScraperMetricInput } from "@/lib/metrics/service"
import logger from "@/lib/scrapers/logger"
import { MARKETS, type MarketResult, type ScraperContext, type SearchResponse } from "@/lib/scrapers/types"

const cache = new Map<string, { data: SearchResponse; timestamp: number }>()
const inFlightRequests = new Map<string, Promise<SearchExecution>>()

const CACHE_TTL = 15 * 60 * 1000
const MAX_CACHE_ENTRIES = 100
const SCRAPER_TIMEOUT_MS = 12000

type ScraperFn = (query: string, context: ScraperContext) => Promise<MarketResult["products"]>
type SearchExecution = {
  response: SearchResponse
  scraperRuns: ScraperMetricInput[]
}

const scrapers: Array<{ marketId: string; fn: ScraperFn }> = [
  { marketId: "barracao", fn: scrapeBarracao },
  { marketId: "tenda", fn: scrapeTenda },
  { marketId: "samsclub", fn: scrapeSamsClub },
  { marketId: "tauste", fn: scrapeTauste },
  { marketId: "confianca", fn: scrapeConfianca },
  { marketId: "atacadao", fn: scrapeAtacadao },
]

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const query = request.nextUrl.searchParams.get("q")?.trim()
  const city = request.nextUrl.searchParams.get("city")?.trim() || "Bauru"
  const state = request.nextUrl.searchParams.get("state")?.trim().toUpperCase() || "SP"

  if (!query || query.length < 3) {
    logger.warn("API", "Busca muito curta", { query })
    return NextResponse.json(
      { error: "A busca precisa ter pelo menos 3 caracteres." },
      { status: 400 }
    )
  }

  if (query.length > 100) {
    logger.warn("API", "Busca muito longa", { length: query.length })
    return NextResponse.json(
      { error: "A busca pode ter no maximo 100 caracteres." },
      { status: 400 }
    )
  }

  if (!city) {
    return NextResponse.json(
      { error: "Informe a cidade para realizar a busca." },
      { status: 400 }
    )
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json(
      { error: "Informe uma UF valida com 2 letras." },
      { status: 400 }
    )
  }

  const region = resolveSearchRegion({ city, state })
  const cacheKey = `${query.toLowerCase()}|${region.normalizedCity}|${region.normalizedState}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info("API", "Retornando resultado do cache", { query, region: region.label })
    const cachedSummary = summarizeSearchResults(cached.data.results)
    recordSearchMetric({
      query,
      city,
      state,
      region,
      latencyMs: performance.now() - startedAt,
      status: "success",
      totalProducts: cachedSummary.totalProducts,
      enabledMarketsCount: region.enabledMarketIds.length,
      successfulMarketsCount: cachedSummary.successfulMarketsCount,
      errorMarketsCount: cachedSummary.errorMarketsCount,
      cacheHit: true,
      cacheMiss: false,
      inFlightReused: false,
    })
    return NextResponse.json(cached.data)
  }

  const existingRequest = inFlightRequests.get(cacheKey)
  if (existingRequest) {
    logger.info("API", "Reaproveitando busca em andamento", { query, region: region.label })
    const sharedExecution = await existingRequest
    const sharedSummary = summarizeSearchResults(sharedExecution.response.results)
    recordSearchMetric({
      query,
      city,
      state,
      region,
      latencyMs: performance.now() - startedAt,
      status: "success",
      totalProducts: sharedSummary.totalProducts,
      enabledMarketsCount: region.enabledMarketIds.length,
      successfulMarketsCount: sharedSummary.successfulMarketsCount,
      errorMarketsCount: sharedSummary.errorMarketsCount,
      cacheHit: false,
      cacheMiss: true,
      inFlightReused: true,
    })
    return NextResponse.json(sharedExecution.response)
  }

  const searchPromise = buildSearchExecution(query, region)

  inFlightRequests.set(cacheKey, searchPromise)

  try {
    const execution = await searchPromise
    cache.set(cacheKey, { data: execution.response, timestamp: Date.now() })
    pruneCache()
    const summary = summarizeSearchResults(execution.response.results)
    recordSearchMetric({
      query,
      city,
      state,
      region,
      latencyMs: performance.now() - startedAt,
      status: "success",
      totalProducts: summary.totalProducts,
      enabledMarketsCount: region.enabledMarketIds.length,
      successfulMarketsCount: summary.successfulMarketsCount,
      errorMarketsCount: summary.errorMarketsCount,
      cacheHit: false,
      cacheMiss: true,
      inFlightReused: false,
      scraperRuns: execution.scraperRuns,
    })
    return NextResponse.json(execution.response)
  } finally {
    inFlightRequests.delete(cacheKey)
  }
}

async function buildSearchExecution(
  query: string,
  region: ReturnType<typeof resolveSearchRegion>
): Promise<SearchExecution> {
  logger.info("API", "Iniciando busca", { query, region: region.label })

  if (!region.isSupported) {
    logger.warn("API", "Regiao ainda nao suportada", { region: region.label })

    return {
      response: {
        query,
        region,
        results: [],
        timestamp: new Date().toISOString(),
      },
      scraperRuns: [],
    }
  }

  const enabledScrapers = scrapers.filter(({ marketId }) => region.enabledMarketIds.includes(marketId))
  const context: ScraperContext = { region }
  const scraperMetrics: ScraperMetricInput[] = []

  const settledResults = await Promise.allSettled(
    enabledScrapers.map(async ({ marketId, fn }) => {
      const market = MARKETS.find((entry) => entry.id === marketId)!
      const scraperStartedAt = performance.now()

      try {
        const products = await withTimeout(
          fn(query, context),
          SCRAPER_TIMEOUT_MS,
          `Tempo limite excedido ao consultar ${market.name}.`
        )

        scraperMetrics.push({
          marketId,
          marketName: market.name,
          status: "success",
          latencyMs: performance.now() - scraperStartedAt,
          productCount: products.length,
          timeout: false,
        })

        return {
          market,
          products,
          status: "success" as const,
          searchedAt: new Date().toISOString(),
        }
      } catch (error) {
        scraperMetrics.push({
          marketId,
          marketName: market.name,
          status: "error",
          latencyMs: performance.now() - scraperStartedAt,
          productCount: 0,
          timeout: error instanceof Error && error.message.includes("Tempo limite excedido"),
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
        })

        return {
          market,
          products: [],
          status: "error" as const,
          error: error instanceof Error ? error.message : "Erro desconhecido",
          searchedAt: new Date().toISOString(),
        }
      }
    })
  )

  const results: MarketResult[] = settledResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value
    }

    const market = MARKETS.find((entry) => entry.id === enabledScrapers[index].marketId)!
    return {
      market,
      products: [],
      status: "error" as const,
      error: "Falha inesperada",
      searchedAt: new Date().toISOString(),
    }
  })

  const totalProducts = results.reduce(
    (sum, item) => sum + (item.status === "success" ? item.products.length : 0),
    0
  )

  logger.success("API", "Busca concluida", {
    region: region.label,
    mercadosSucesso: results.filter((item) => item.status === "success").length,
    totalProdutos: totalProducts,
  })

  return {
    response: {
      query,
      region,
      results,
      timestamp: new Date().toISOString(),
    },
    scraperRuns: scraperMetrics,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}

function pruneCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) {
    return
  }

  const now = Date.now()
  for (const [key, value] of cache) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key)
    }
  }

  logger.debug("API", "Cache limpo", { novoTamanho: cache.size })
}
