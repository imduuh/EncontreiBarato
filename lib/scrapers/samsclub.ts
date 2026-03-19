/**
 * =============================================================================
 * SCRAPER DO SAM'S CLUB BRASIL
 * =============================================================================
 * 
 * O Sam's Club Brasil usa a plataforma VTEX para seu e-commerce.
 * O site oferece varias APIs para busca de produtos.
 * 
 * ESTRATEGIAS UTILIZADAS:
 * 1. VTEX Catalog API (mais estavel)
 * 2. VTEX Intelligent Search API (alternativa)
 * 3. Scrape HTML com dados __STATE__ (fallback)
 * 
 * OBSERVACOES:
 * - O Sam's Club e um clube de compras, entao alguns precos podem
 *   exigir cadastro ou cartao de membro para serem exibidos.
 */

import logger from "./logger"
import type { MarketProduct } from "./types"

// ============================================================================
// CONSTANTES E CONFIGURACAO
// ============================================================================

const MARKET_NAME = "SamsClub"
const BASE_URL = "https://www.samsclub.com.br"
const TIMEOUT_MS = 12000
const MAX_PRODUCTS = 10

// Headers para simular navegador
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
}

// ============================================================================
// TIPOS PARA AS RESPOSTAS DA API
// ============================================================================

interface VtexProduct {
  productName?: string
  productTitle?: string
  items?: Array<{
    sellers?: Array<{
      commertialOffer?: {
        Price?: number
        ListPrice?: number
        AvailableQuantity?: number
      }
    }>
    images?: Array<{
      imageUrl?: string
    }>
    name?: string
  }>
  link?: string
  linkText?: string
}

interface IntelligentSearchProduct {
  productName?: string
  name?: string
  priceRange?: {
    sellingPrice?: {
      lowPrice?: number
      highPrice?: number
    }
  }
  items?: Array<{
    sellers?: Array<{
      commertialOffer?: {
        Price?: number
      }
    }>
    images?: Array<{
      imageUrl?: string
    }>
  }>
  link?: string
}

// ============================================================================
// FUNCAO PRINCIPAL
// ============================================================================

/**
 * Funcao principal do scraper do Sam's Club.
 * Tenta multiplas estrategias para buscar produtos.
 * 
 * @param query - Termo de busca
 * @returns Lista de produtos encontrados
 */
export async function scrapeSamsClub(query: string): Promise<MarketProduct[]> {
  logger.info(MARKET_NAME, "Iniciando busca", { query })

  // Estrategia 1: VTEX Catalog API
  let products = await tryCatalogApi(query)
  if (products.length > 0) {
    logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via Catalog API`)
    return products.slice(0, MAX_PRODUCTS)
  }

  // Estrategia 2: Intelligent Search API
  products = await tryIntelligentSearch(query)
  if (products.length > 0) {
    logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via Intelligent Search`)
    return products.slice(0, MAX_PRODUCTS)
  }

  // Estrategia 3: Scrape HTML
  products = await tryHtmlScrape(query)
  if (products.length > 0) {
    logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via HTML`)
    return products.slice(0, MAX_PRODUCTS)
  }

  logger.warn(MARKET_NAME, "Nenhum produto encontrado")
  return []
}

// ============================================================================
// ESTRATEGIAS DE BUSCA
// ============================================================================

/**
 * Estrategia 1: VTEX Catalog API
 * API de catalogo do VTEX - mais estavel e confiavel.
 */
async function tryCatalogApi(query: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?_from=0&_to=9`

  logger.request(MARKET_NAME, "GET", url)

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const data = (await response.json()) as VtexProduct[]

    if (!Array.isArray(data) || data.length === 0) return products

    logger.debug(MARKET_NAME, "Catalog API retornou", { count: data.length })

    for (const item of data) {
      if (products.length >= MAX_PRODUCTS) break

      const product = parseVtexProduct(item)
      if (product) products.push(product)
    }

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na Catalog API", error)
  }

  return products
}

/**
 * Estrategia 2: VTEX Intelligent Search API
 * API de busca inteligente com suporte a relevancia.
 */
async function tryIntelligentSearch(query: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/api/io/_v/api/intelligent-search/product_search/0/10?query=${encodeURIComponent(query)}&locale=pt-BR`

  logger.request(MARKET_NAME, "GET", url)

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const data = await response.json()
    const searchProducts = (data?.products || []) as IntelligentSearchProduct[]

    logger.debug(MARKET_NAME, "Intelligent Search retornou", { count: searchProducts.length })

    for (const item of searchProducts) {
      if (products.length >= MAX_PRODUCTS) break

      const product = parseIntelligentSearchProduct(item)
      if (product) products.push(product)
    }

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na Intelligent Search API", error)
  }

  return products
}

/**
 * Estrategia 3: Scrape HTML
 * Busca dados __STATE__ embutidos no HTML (padrao VTEX SSR).
 */
async function tryHtmlScrape(query: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/s/${encodeURIComponent(query)}`

  logger.request(MARKET_NAME, "GET", url)

  try {
    const response = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const html = await response.text()
    logger.debug(MARKET_NAME, "HTML recebido", { tamanho: html.length })

    // Procurar dados __STATE__ (padrao VTEX SSR)
    const stateMatch = html.match(/__STATE__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/)
    if (stateMatch) {
      logger.info(MARKET_NAME, "Dados __STATE__ encontrados")
      
      try {
        const state = JSON.parse(stateMatch[1])
        
        // Encontrar chaves de produtos
        const productKeys = Object.keys(state).filter(
          (key) => key.startsWith("Product:") && !key.includes(".")
        )
        
        logger.debug(MARKET_NAME, "Produtos em __STATE__", { count: productKeys.length })

        for (const key of productKeys.slice(0, MAX_PRODUCTS)) {
          const prod = state[key]
          if (prod?.productName) {
            // Buscar preco em outras chaves do estado
            let price = 0
            for (const stateKey of Object.keys(state)) {
              if (stateKey.includes(key) && state[stateKey]?.Price) {
                price = state[stateKey].Price
                break
              }
            }

            products.push({
              name: prod.productName.substring(0, 200),
              price,
              priceFormatted: price > 0 ? formatPrice(price) : "Preco indisponivel",
              imageUrl: null,
              productUrl: prod.link ? `${BASE_URL}${prod.link}` : null,
              unit: null,
            })
          }
        }
      } catch {
        logger.error(MARKET_NAME, "Falha ao interpretar __STATE__")
      }
    }

    // Tentar __NEXT_DATA__ como fallback
    if (products.length === 0) {
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (nextDataMatch) {
        logger.debug(MARKET_NAME, "__NEXT_DATA__ encontrado, tentando extrair...")
        // Estrutura varia muito, log para debug futuro
      }
    }

  } catch (error) {
    logger.error(MARKET_NAME, "Erro no scrape HTML", error)
  }

  return products
}

// ============================================================================
// FUNCOES DE PARSING
// ============================================================================

/**
 * Parse de produto da Catalog API (formato VTEX classico).
 */
function parseVtexProduct(item: VtexProduct): MarketProduct | null {
  const name = item.productName || item.productTitle || ""
  if (!name) return null

  const firstItem = item.items?.[0]
  const seller = firstItem?.sellers?.[0]
  const price = seller?.commertialOffer?.Price || 0
  const imageUrl = firstItem?.images?.[0]?.imageUrl || null
  
  let productUrl: string | null = null
  if (item.link) {
    productUrl = item.link.startsWith("http") ? item.link : `${BASE_URL}${item.link}`
  } else if (item.linkText) {
    productUrl = `${BASE_URL}/${item.linkText}/p`
  }

  return {
    name: name.substring(0, 200),
    price,
    priceFormatted: price > 0 ? formatPrice(price) : "Preco indisponivel",
    imageUrl,
    productUrl,
    unit: null,
  }
}

/**
 * Parse de produto da Intelligent Search API.
 */
function parseIntelligentSearchProduct(item: IntelligentSearchProduct): MarketProduct | null {
  const name = item.productName || item.name || ""
  if (!name) return null

  const price =
    item.priceRange?.sellingPrice?.lowPrice ||
    item.items?.[0]?.sellers?.[0]?.commertialOffer?.Price ||
    0
  const imageUrl = item.items?.[0]?.images?.[0]?.imageUrl || null
  const productUrl = item.link ? `${BASE_URL}${item.link}` : null

  return {
    name: name.substring(0, 200),
    price,
    priceFormatted: price > 0 ? formatPrice(price) : "Preco indisponivel",
    imageUrl,
    productUrl,
    unit: null,
  }
}

/**
 * Formata um numero como preco em Reais.
 */
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}
