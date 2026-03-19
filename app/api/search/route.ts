/**
 * =============================================================================
 * API DE BUSCA DE PRODUTOS
 * =============================================================================
 * 
 * Endpoint: GET /api/search?q={termo}
 * 
 * Esta API busca produtos em todos os mercados configurados em paralelo.
 * Os resultados sao cacheados por 15 minutos para melhorar performance.
 * 
 * PARAMETROS:
 * - q: termo de busca (minimo 3 caracteres, maximo 100)
 * 
 * RESPOSTA:
 * {
 *   query: string,
 *   results: MarketResult[],
 *   timestamp: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { scrapeTenda } from "@/lib/scrapers/tenda"
import { scrapeSamsClub } from "@/lib/scrapers/samsclub"
import { scrapeTauste } from "@/lib/scrapers/tauste"
import { scrapeConfianca } from "@/lib/scrapers/confianca"
import { scrapeAtacadao } from "@/lib/scrapers/atacadao"
import logger from "@/lib/scrapers/logger"
import { MARKETS, type MarketResult, type SearchResponse } from "@/lib/scrapers/types"

// ============================================================================
// CONFIGURACAO DE CACHE
// ============================================================================

/**
 * Cache em memoria para armazenar resultados de busca.
 * Evita fazer requisicoes repetidas aos mercados.
 */
const cache = new Map<string, { data: SearchResponse; timestamp: number }>()

/** Tempo de vida do cache: 15 minutos */
const CACHE_TTL = 15 * 60 * 1000

/** Numero maximo de entradas no cache antes de limpar */
const MAX_CACHE_ENTRIES = 100

// ============================================================================
// HANDLER DA API
// ============================================================================

export async function GET(request: NextRequest) {
  // -------------------------------------------------------------------------
  // VALIDACAO DO PARAMETRO DE BUSCA
  // -------------------------------------------------------------------------
  const query = request.nextUrl.searchParams.get("q")?.trim()

  // Validar tamanho minimo
  if (!query || query.length < 3) {
    logger.warn("API", "Busca muito curta", { query })
    return NextResponse.json(
      { error: "A busca precisa ter pelo menos 3 caracteres." },
      { status: 400 }
    )
  }

  // Validar tamanho maximo
  if (query.length > 100) {
    logger.warn("API", "Busca muito longa", { length: query.length })
    return NextResponse.json(
      { error: "A busca pode ter no maximo 100 caracteres." },
      { status: 400 }
    )
  }

  // -------------------------------------------------------------------------
  // VERIFICAR CACHE
  // -------------------------------------------------------------------------
  const cacheKey = query.toLowerCase()
  const cached = cache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info("API", "Retornando resultado do cache", { query })
    return NextResponse.json(cached.data)
  }

  // -------------------------------------------------------------------------
  // EXECUTAR SCRAPERS EM PARALELO
  // -------------------------------------------------------------------------
  logger.info("API", "Iniciando busca em todos os mercados", { query })

  /**
   * Mapeamento de scrapers.
   * Cada scraper e associado ao ID do seu mercado.
   */
  const scrapers = [
    { marketId: "tenda", fn: scrapeTenda },
    { marketId: "samsclub", fn: scrapeSamsClub },
    { marketId: "tauste", fn: scrapeTauste },
    { marketId: "confianca", fn: scrapeConfianca },
    { marketId: "atacadao", fn: scrapeAtacadao },
  ]

  // Executar todos os scrapers em paralelo usando Promise.allSettled
  // Isso garante que a falha de um scraper nao afeta os outros
  const settledResults = await Promise.allSettled(
    scrapers.map(async ({ marketId, fn }) => {
      const market = MARKETS.find((m) => m.id === marketId)!
      
      try {
        const products = await fn(query)
        
        return {
          market,
          products,
          status: "success" as const,
          searchedAt: new Date().toISOString(),
        }
      } catch (error) {
        // Scraper falhou, retornar resultado de erro
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

  // -------------------------------------------------------------------------
  // PROCESSAR RESULTADOS
  // -------------------------------------------------------------------------
  const results: MarketResult[] = settledResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value
    }
    
    // Promise rejeitada (nao deveria acontecer com o try/catch acima)
    const market = MARKETS.find((m) => m.id === scrapers[index].marketId)!
    return {
      market,
      products: [],
      status: "error" as const,
      error: "Falha inesperada",
      searchedAt: new Date().toISOString(),
    }
  })

  // Contar resultados para log
  const totalProducts = results.reduce(
    (sum, r) => sum + (r.status === "success" ? r.products.length : 0),
    0
  )
  const successCount = results.filter(r => r.status === "success").length

  logger.success("API", "Busca concluida", {
    mercadosSucesso: successCount,
    totalProdutos: totalProducts,
  })

  // -------------------------------------------------------------------------
  // PREPARAR RESPOSTA
  // -------------------------------------------------------------------------
  const responseData: SearchResponse = {
    query,
    results,
    timestamp: new Date().toISOString(),
  }

  // Salvar no cache
  cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

  // -------------------------------------------------------------------------
  // LIMPAR CACHE ANTIGO
  // -------------------------------------------------------------------------
  // Se o cache estiver muito grande, remover entradas expiradas
  if (cache.size > MAX_CACHE_ENTRIES) {
    const now = Date.now()
    for (const [key, value] of cache) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key)
      }
    }
    logger.debug("API", "Cache limpo", { novoTamanho: cache.size })
  }

  return NextResponse.json(responseData)
}
