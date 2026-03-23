/**
 * =============================================================================
 * SCRAPER DO CONFIANCA SUPERMERCADOS
 * =============================================================================
 * 
 * O Confianca usa Oracle Commerce Cloud (OCC) para seu e-commerce.
 * A API de busca e bem documentada e retorna JSON estruturado.
 * 
 * ENDPOINT:
 * /ccstore/v1/search - API REST do OCC
 * 
 * PARAMETROS:
 * - Ntt: termo de busca
 * - Nrpp: numero de resultados por pagina
 * - Ns: ordenacao (factorQuantitySold30d|1 = mais vendidos)
 * 
 * ESTRUTURA DA RESPOSTA:
 * {
 *   resultsList: {
 *     records: [
 *       {
 *         records: [
 *           { attributes: { ... } }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

import logger from "./logger"
import type { MarketProduct, ScraperContext } from "./types"

// ============================================================================
// CONSTANTES E CONFIGURACAO
// ============================================================================

const MARKET_NAME = "Confianca"
const BASE_URL = "https://www.confianca.com.br"
const TIMEOUT_MS = 15000
const MAX_PRODUCTS = 10

// Headers para a API OCC
const API_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": `${BASE_URL}/bauru/search`,
  "Origin": BASE_URL,
}

// ============================================================================
// FUNCAO PRINCIPAL
// ============================================================================

/**
 * Funcao principal do scraper do Confianca.
 * Usa a API REST do Oracle Commerce Cloud.
 * 
 * @param query - Termo de busca
 * @returns Lista de produtos encontrados
 */
export async function scrapeConfianca(query: string, _context?: ScraperContext): Promise<MarketProduct[]> {
  // URL da API OCC com parametros de busca
  // Ns=product.analytics.factorQuantitySold30d|1 ordena por mais vendidos
  const apiUrl = `${BASE_URL}/ccstore/v1/search?Ntt=${encodeURIComponent(query)}&Nrpp=16&Ns=product.analytics.factorQuantitySold30d|1`

  logger.info(MARKET_NAME, "Iniciando busca", { query })
  logger.request(MARKET_NAME, "GET", apiUrl)

  try {
    const response = await fetch(apiUrl, {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const json = await response.json()

    // Extrair produtos da resposta OCC
    const products = extractOccProducts(json)

    if (products.length > 0) {
      logger.success(MARKET_NAME, `Encontrados ${products.length} produtos`)
      return products.slice(0, MAX_PRODUCTS)
    }

    logger.warn(MARKET_NAME, "Nenhum produto encontrado na resposta")
    return []

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na busca", error)
    throw error
  }
}

// ============================================================================
// FUNCOES DE EXTRACAO
// ============================================================================

/**
 * Extrai produtos da resposta da API OCC.
 * A estrutura OCC e um pouco complexa com records aninhados.
 * 
 * @param json - Resposta JSON da API
 * @returns Lista de produtos extraidos
 */
function extractOccProducts(json: unknown): MarketProduct[] {
  const products: MarketProduct[] = []

  // Validar estrutura basica
  if (!json || typeof json !== "object") {
    logger.warn(MARKET_NAME, "Resposta invalida - nao e um objeto")
    return products
  }

  const data = json as Record<string, unknown>
  const resultsList = data.resultsList as Record<string, unknown> | undefined

  if (!resultsList || !Array.isArray(resultsList.records)) {
    logger.warn(MARKET_NAME, "Estrutura invalida - falta resultsList.records")
    return products
  }

  logger.debug(MARKET_NAME, "Records encontrados", { count: resultsList.records.length })

  // Iterar pelos grupos de records
  for (const recordGroup of resultsList.records as Array<Record<string, unknown>>) {
    if (products.length >= MAX_PRODUCTS) break

    // Cada recordGroup tem um array "records" interno com os atributos
    const innerRecords = recordGroup.records as Array<Record<string, unknown>> | undefined
    
    if (!Array.isArray(innerRecords) || innerRecords.length === 0) continue

    // Pegar o primeiro record interno (contem os atributos do produto)
    const productData = innerRecords[0]
    
    if (!productData?.attributes) continue

    const product = parseOccProduct(productData.attributes as Record<string, unknown[]>)
    if (product) products.push(product)
  }

  return products
}

/**
 * Parse de um produto a partir dos atributos OCC.
 * No OCC, cada atributo e um array (geralmente com um unico valor).
 * 
 * @param attrs - Objeto de atributos do produto
 * @returns MarketProduct ou null se invalido
 */
function parseOccProduct(attrs: Record<string, unknown[]>): MarketProduct | null {
  // -------------------------------------------------------------------------
  // NOME DO PRODUTO
  // -------------------------------------------------------------------------
  // Tentar varios campos de nome
  const name =
    getFirstString(attrs["product.displayName"]) ||
    getFirstString(attrs["product.x_displayName"]) ||
    getFirstString(attrs["product.name"]) ||
    ""

  if (!name || name.length < 3) return null

  // -------------------------------------------------------------------------
  // PRECO
  // -------------------------------------------------------------------------
  // Tentar varios campos de preco
  const price =
    getFirstNumber(attrs["sku.activePrice"]) ||
    getFirstNumber(attrs["product.currentPrice"]) ||
    getFirstNumber(attrs["sku.salePrice"]) ||
    getFirstNumber(attrs["sku.listPrice"]) ||
    0

  // -------------------------------------------------------------------------
  // IMAGEM
  // -------------------------------------------------------------------------
  let imageUrl =
    getFirstString(attrs["product.primaryThumbImageURL"]) ||
    getFirstString(attrs["product.primarySmallImageURL"]) ||
    getFirstString(attrs["product.primaryMediumImageURL"]) ||
    getFirstString(attrs["product.primaryLargeImageURL"]) ||
    null

  if (imageUrl) {
    imageUrl = normalizeUrl(imageUrl)
  }

  // -------------------------------------------------------------------------
  // URL DO PRODUTO
  // -------------------------------------------------------------------------
  const route = getFirstString(attrs["product.route"])
  const productUrl = route ? `${BASE_URL}${route}` : null

  // -------------------------------------------------------------------------
  // RETORNAR PRODUTO
  // -------------------------------------------------------------------------
  return {
    name: name.substring(0, 200),
    price,
    priceFormatted: price > 0 ? formatPrice(price) : "Preco indisponivel",
    imageUrl,
    productUrl,
    unit: null,
  }
}

// ============================================================================
// FUNCOES AUXILIARES
// ============================================================================

/**
 * Extrai o primeiro valor string de um atributo OCC.
 * Atributos OCC sao arrays, entao pegamos o primeiro elemento.
 * 
 * @param arr - Array de valores ou valor direto
 * @returns String ou null
 */
function getFirstString(arr: unknown): string | null {
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
    return arr[0]
  }
  if (typeof arr === "string") {
    return arr
  }
  return null
}

/**
 * Extrai o primeiro valor numerico de um atributo OCC.
 * 
 * @param arr - Array de valores ou valor direto
 * @returns Number ou null
 */
function getFirstNumber(arr: unknown): number | null {
  if (Array.isArray(arr) && arr.length > 0) {
    const val = arr[0]
    if (typeof val === "number") return val
    if (typeof val === "string") {
      // Tratar formato brasileiro (virgula como decimal)
      const parsed = parseFloat(val.replace(",", "."))
      if (!isNaN(parsed)) return parsed
    }
  }
  if (typeof arr === "number") return arr
  return null
}

/**
 * Normaliza uma URL para ser absoluta.
 * 
 * @param url - URL que pode ser relativa
 * @returns URL absoluta
 */
function normalizeUrl(url: string): string {
  if (url.startsWith("http")) return url
  if (url.startsWith("//")) return `https:${url}`
  return `${BASE_URL}${url}`
}

/**
 * Formata um numero como preco em Reais.
 */
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}
