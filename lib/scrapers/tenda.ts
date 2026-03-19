/**
 * =============================================================================
 * SCRAPER DO TENDA ATACADO
 * =============================================================================
 * 
 * O Tenda Atacado usa uma plataforma propria (customizada).
 * O site renderiza os precos via JavaScript (client-side), entao o HTML
 * inicial nao contem os precos dos produtos.
 * 
 * ESTRATEGIAS UTILIZADAS:
 * 1. Buscar dados JSON embutidos no HTML (window.__INITIAL_STATE__, etc)
 * 2. Tentar API interna do site
 * 3. Fallback: extrair nomes e imagens do HTML, sem precos
 * 
 * LIMITACOES:
 * - O site exige CEP para mostrar precos (sistema de regionalizacao)
 * - Precos sao carregados via JS apos o carregamento inicial
 * - Sem API publica documentada
 */

import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"
import logger from "./logger"
import type { BulkPrice, MarketProduct } from "./types"

// Constantes de configuracao
const MARKET_NAME = "Tenda"
const BASE_URL = "https://www.tendaatacado.com.br"
const TIMEOUT_MS = 12000
const MAX_PRODUCTS = 10

// Headers para simular um navegador real
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
}

/**
 * Funcao principal do scraper do Tenda.
 * Busca produtos no site do Tenda Atacado.
 * 
 * @param query - Termo de busca (ex: "arroz", "feijao")
 * @returns Lista de produtos encontrados (maximo 10)
 */
export async function scrapeTenda(query: string): Promise<MarketProduct[]> {
  const searchUrl = `${BASE_URL}/busca?q=${encodeURIComponent(query)}`
  
  logger.info(MARKET_NAME, "Iniciando busca", { query })
  logger.request(MARKET_NAME, "GET", searchUrl)

  try {
    // Fazer requisicao para a pagina de busca
    const response = await fetch(searchUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    logger.info(MARKET_NAME, "HTML recebido", { tamanho: html.length })

    // Estrategia 1: Tentar extrair dados JSON embutidos no HTML
    const jsonProducts = extractProductsFromEmbeddedJson(html)
    if (jsonProducts.length > 0) {
      const rankedProducts = rankAndFilterProducts(query, jsonProducts)
      logger.success(MARKET_NAME, `Encontrados ${rankedProducts.length} produtos via JSON embutido`)
      return rankedProducts.slice(0, MAX_PRODUCTS)
    }

    // Estrategia 2: Parse do HTML
    const htmlProducts = extractProductsFromHtml(html)
    if (htmlProducts.length > 0) {
      const rankedProducts = rankAndFilterProducts(query, htmlProducts)
      logger.success(MARKET_NAME, `Encontrados ${rankedProducts.length} produtos via HTML`)
      return rankedProducts.slice(0, MAX_PRODUCTS)
    }

    logger.warn(MARKET_NAME, "Nenhum produto encontrado")
    return []

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na busca", error)
    throw error
  }
}

/**
 * Tenta extrair produtos de dados JSON embutidos no HTML.
 * Muitos sites React/Next.js embutem o estado inicial em tags <script>.
 * 
 * @param html - HTML da pagina
 * @returns Lista de produtos extraidos
 */
function extractProductsFromEmbeddedJson(html: string): MarketProduct[] {
  const products: MarketProduct[] = []
  
  // Padroes comuns de dados embutidos
  const jsonPatterns = [
    // Next.js data
    /__NEXT_DATA__[^>]*>([^<]+)</i,
    // Estados globais
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
    /window\.__data\s*=\s*(\{[\s\S]*?\});/,
    /window\.__STATE__\s*=\s*(\{[\s\S]*?\});/,
    // Dados de produto inline
    /"products"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
    /"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
  ]

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      try {
        const jsonStr = match[1].trim()
        const data = JSON.parse(jsonStr)
        
        logger.debug(MARKET_NAME, "JSON encontrado com padrao", { pattern: pattern.source.substring(0, 30) })
        
        // Extrair produtos recursivamente do JSON
        const extracted = extractProductsFromObject(data)
        if (extracted.length > 0) {
          return extracted
        }
      } catch {
        // JSON invalido, tentar proximo padrao
        continue
      }
    }
  }

  return products
}

/**
 * Extrai produtos recursivamente de um objeto JSON.
 * Procura por estruturas que parecem ser produtos (tem name e price).
 * 
 * @param obj - Objeto a ser analisado
 * @param depth - Profundidade atual da recursao (para evitar loops infinitos)
 * @returns Lista de produtos encontrados
 */
function extractProductsFromObject(obj: unknown, depth = 0): MarketProduct[] {
  const products: MarketProduct[] = []
  
  // Limitar profundidade para evitar recursao infinita
  if (depth > 6 || !obj || typeof obj !== "object") {
    return products
  }

  // Se for um array, verificar cada item
  if (Array.isArray(obj)) {
    for (const item of obj) {
      // Verificar se o item parece ser um produto
      if (isProductLike(item)) {
        const product = parseProductObject(item)
        if (product) {
          products.push(product)
        }
      } else {
        // Continuar buscando recursivamente
        products.push(...extractProductsFromObject(item, depth + 1))
      }
      
      // Limitar quantidade
      if (products.length >= MAX_PRODUCTS) break
    }
    return products
  }

  // Se for um objeto, verificar propriedades
  const record = obj as Record<string, unknown>
  
  // Verificar se o proprio objeto e um produto
  if (isProductLike(record)) {
    const product = parseProductObject(record)
    if (product) {
      products.push(product)
    }
  }

  // Buscar em propriedades que podem conter listas de produtos
  const productListKeys = ["products", "items", "results", "data", "content", "records"]
  for (const key of productListKeys) {
    if (record[key] && Array.isArray(record[key])) {
      products.push(...extractProductsFromObject(record[key], depth + 1))
    }
  }

  // Se ainda nao encontrou, buscar recursivamente
  if (products.length === 0) {
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        products.push(...extractProductsFromObject(value, depth + 1))
      }
      if (products.length >= MAX_PRODUCTS) break
    }
  }

  return products
}

/**
 * Verifica se um objeto parece ser um produto.
 * Um produto deve ter pelo menos um nome.
 */
function isProductLike(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object") return false
  const record = obj as Record<string, unknown>
  
  // Deve ter alguma propriedade de nome
  const hasName = !!(
    record.name || 
    record.productName || 
    record.title || 
    record.displayName ||
    record.description
  )

  const productUrl = getProductUrl(record)
  const hasPricingData = typeof getNumericValue(record.price) === "number"
    || Array.isArray(record.wholesalePrices)
    || !!record.promotion

  return hasName && (!!productUrl || hasPricingData)
}

/**
 * Converte um objeto generico em MarketProduct.
 * Tenta extrair nome, preco, imagem e URL de varias propriedades possiveis.
 */
function parseProductObject(obj: Record<string, unknown>): MarketProduct | null {
  // Extrair nome
  const name = String(
    obj.name || 
    obj.productName || 
    obj.title || 
    obj.displayName ||
    obj.description ||
    ""
  ).trim()

  if (!name || name.length < 3) return null

  const productUrl = getProductUrl(obj)
  if (!productUrl) return null

  // Extrair preco (pode estar em varias propriedades)
  let price = extractBasePrice(obj)
  let bulkPrice = extractBulkPrice(obj, price)

  // Promocoes sem quantidade minima devem sobrescrever o preco cheio
  const promotion = extractPromotion(obj)
  if (promotion && promotion.minQuantity <= 1) {
    price = promotion.price
  } else if (promotion && !bulkPrice) {
    bulkPrice = promotion
  }

  // Extrair imagem
  let imageUrl: string | null = null
  const imageFields = ["imageUrl", "image", "img", "thumbnail", "foto", "picture"]
  for (const field of imageFields) {
    const val = obj[field]
    if (typeof val === "string" && val.length > 0) {
      imageUrl = val.startsWith("http") ? val : `${BASE_URL}${val}`
      break
    }
  }
  
  // Verificar se imagem esta em um array
  if (!imageUrl) {
    const images = obj.images as unknown[] | undefined
    if (Array.isArray(images) && images.length > 0) {
      const firstImg = images[0]
      if (typeof firstImg === "string") {
        imageUrl = firstImg.startsWith("http") ? firstImg : `${BASE_URL}${firstImg}`
      } else if (firstImg && typeof firstImg === "object") {
        const imgObj = firstImg as Record<string, unknown>
        const url = imgObj.url || imgObj.src || imgObj.imageUrl
        if (typeof url === "string") {
          imageUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`
        }
      }
    }
  }

  return {
    name: name.substring(0, 200),
    price,
    priceFormatted: price > 0 ? formatPrice(price) : "Preco indisponivel",
    imageUrl,
    productUrl,
    unit: null,
    bulkPrice,
  }
}

function extractBasePrice(obj: Record<string, unknown>): number {
  const priceFields = ["price", "salePrice", "sellingPrice", "spotPrice", "finalPrice", "valor"]
  for (const field of priceFields) {
    const price = getNumericValue(obj[field])
    if (price > 0) return price
  }

  return 0
}

function extractBulkPrice(obj: Record<string, unknown>, basePrice: number): BulkPrice | undefined {
  const wholesalePrices = obj.wholesalePrices
  if (Array.isArray(wholesalePrices) && wholesalePrices.length > 0) {
    const validWholesalePrices = wholesalePrices
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null
        const record = entry as Record<string, unknown>
        const minQuantity = Math.trunc(getNumericValue(record.minQuantity))
        const price = getNumericValue(record.price)
        if (minQuantity <= 1 || price <= 0) return null
        return {
          price,
          minQuantity,
          priceFormatted: formatPrice(price),
          description: `A partir de ${minQuantity} unidades`,
        } satisfies BulkPrice
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .sort((a, b) => a.price - b.price)

    if (validWholesalePrices.length > 0) {
      return validWholesalePrices[0]
    }
  }

  const promotion = extractPromotion(obj)
  if (promotion && promotion.minQuantity > 1 && promotion.price < basePrice) {
    return promotion
  }

  return undefined
}

function extractPromotion(obj: Record<string, unknown>): BulkPrice | undefined {
  const promotion = obj.promotion
  if (!promotion || typeof promotion !== "object") return undefined

  const record = promotion as Record<string, unknown>
  const promoPrice = getNumericValue(record.price)
  if (promoPrice <= 0) return undefined

  const promotionType = String(record.type || "").trim()
  const xValue = Math.trunc(getNumericValue(record.x))
  const yValue = Math.trunc(getNumericValue(record.y))

  if (promotionType === "Leve X Pague Y" && xValue > 1 && yValue > 0) {
    return {
      price: promoPrice,
      minQuantity: xValue,
      priceFormatted: formatPrice(promoPrice),
      description: `Leve ${xValue}, pague ${yValue}`,
    }
  }

  if (promotionType === "X% Off na Y unidade" && yValue > 1 && xValue > 0) {
    return {
      price: promoPrice,
      minQuantity: yValue,
      priceFormatted: formatPrice(promoPrice),
      description: `${xValue}% off na ${formatOrdinal(yValue)} unidade`,
    }
  }

  if (promotionType === "Desconto Percentual X" && xValue > 0) {
    return {
      price: promoPrice,
      minQuantity: 1,
      priceFormatted: formatPrice(promoPrice),
      description: `${xValue}% de desconto`,
    }
  }

  return {
    price: promoPrice,
    minQuantity: xValue > 1 ? xValue : 1,
    priceFormatted: formatPrice(promoPrice),
    description: String(record.name || "").trim() || undefined,
  }
}

function getProductUrl(obj: Record<string, unknown>): string | null {
  const urlFields = ["url", "link", "href", "productUrl", "slug"]
  for (const field of urlFields) {
    const val = obj[field]
    if (typeof val !== "string" || val.length === 0) continue

    const normalizedUrl = val.startsWith("http") ? val : `${BASE_URL}${val.startsWith("/") ? val : `/${val}`}`
    if (normalizedUrl.includes("/produto/")) {
      return normalizedUrl
    }
  }

  return null
}

function getNumericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."))
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 0
}

function formatOrdinal(value: number): string {
  if (value === 1) return "1a"
  if (value === 2) return "2a"
  if (value === 3) return "3a"
  return `${value}a`
}

function rankAndFilterProducts(query: string, products: MarketProduct[]): MarketProduct[] {
  const uniqueProducts = dedupeProducts(products)
  if (uniqueProducts.length <= 1) {
    return uniqueProducts
  }

  const queryText = normalizeSearchText(query)
  const queryTokens = queryText.split(/\s+/).filter(Boolean)
  const queryMeasures = extractMeasureTokens(queryText)
  const queryNumbers = extractNumberTokens(queryText)

  let rankedProducts = uniqueProducts

  if (queryMeasures.length > 0) {
    const exactMeasureMatches = uniqueProducts.filter((product) => {
      const productText = normalizeSearchText(product.name)
      const productMeasures = extractMeasureTokens(productText)
      return queryMeasures.every((measure) => productMeasures.includes(measure))
    })

    if (exactMeasureMatches.length > 0) {
      rankedProducts = exactMeasureMatches
    }
  } else if (queryNumbers.length > 0) {
    const exactNumberMatches = uniqueProducts.filter((product) => {
      const productNumbers = extractNumberTokens(normalizeSearchText(product.name))
      return queryNumbers.every((numberToken) => productNumbers.includes(numberToken))
    })

    if (exactNumberMatches.length > 0) {
      rankedProducts = exactNumberMatches
    }
  }

  return rankedProducts
    .map((product) => ({
      product,
      score: computeRelevanceScore(product, queryText, queryTokens, queryMeasures, queryNumbers),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product)
}

function dedupeProducts(products: MarketProduct[]): MarketProduct[] {
  const seen = new Set<string>()
  const uniqueProducts: MarketProduct[] = []

  for (const product of products) {
    const key = `${product.productUrl || ""}|${normalizeSearchText(product.name)}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueProducts.push(product)
  }

  return uniqueProducts
}

function computeRelevanceScore(
  product: MarketProduct,
  queryText: string,
  queryTokens: string[],
  queryMeasures: string[],
  queryNumbers: string[]
): number {
  const productText = normalizeSearchText(product.name)
  const productMeasures = extractMeasureTokens(productText)
  const productNumbers = extractNumberTokens(productText)
  let score = 0

  if (productText === queryText) {
    score += 100
  } else if (productText.includes(queryText)) {
    score += 60
  }

  for (const token of queryTokens) {
    if (productText.includes(token)) {
      score += token.length >= 4 ? 8 : 4
    }
  }

  for (const measure of queryMeasures) {
    if (productMeasures.includes(measure)) {
      score += 20
    } else {
      score -= 25
    }
  }

  for (const numberToken of queryNumbers) {
    if (productNumbers.includes(numberToken)) {
      score += 12
    } else {
      score -= 10
    }
  }

  return score
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractMeasureTokens(value: string): string[] {
  return [...value.matchAll(/\b\d+(?:[.,]\d+)?\s*(kg|g|mg|l|ml|un)\b/g)].map((match) =>
    match[0].replace(/\s+/g, "")
  )
}

function extractNumberTokens(value: string): string[] {
  return [...value.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => match[0])
}

/**
 * Extrai produtos do HTML usando Cheerio.
 * Fallback quando nao ha dados JSON embutidos.
 * 
 * @param html - HTML da pagina
 * @returns Lista de produtos extraidos
 */
function extractProductsFromHtml(html: string): MarketProduct[] {
  const products: MarketProduct[] = []
  const $ = cheerio.load(html)

  // Seletores para cards de produto (varios padroes comuns)
  const cardSelectors = [
    'a[href*="/produto/"]',
    'a[href*="/p/"]',
    '[class*="product-card"]',
    '[class*="ProductCard"]',
    '[data-testid*="product"]',
    'article[class*="product"]',
  ]

  // Tentar cada seletor ate encontrar produtos
  for (const selector of cardSelectors) {
    const cards = $(selector)
    
    if (cards.length > 0) {
      logger.debug(MARKET_NAME, `Encontrados ${cards.length} elementos com seletor: ${selector}`)
      
      cards.each((_, element) => {
        if (products.length >= MAX_PRODUCTS) return false

        const product = parseHtmlProductCard($, element)
        if (product) {
          products.push(product)
        }
      })

      if (products.length > 0) break
    }
  }

  return products
}

/**
 * Extrai informacoes de um card de produto HTML.
 */
function parseHtmlProductCard($: cheerio.CheerioAPI, element: AnyNode): MarketProduct | null {
  const $el = $(element)
  
  // Extrair nome - tentar varios seletores
  let name = ""
  const nameSelectors = ["h3", "h2", "h4", '[class*="name"]', '[class*="title"]', '[class*="Name"]', '[class*="Title"]']
  for (const sel of nameSelectors) {
    const text = $el.find(sel).first().text().trim()
    if (text && text.length > 3) {
      name = text
      break
    }
  }
  
  // Fallback: usar o atributo title do link
  if (!name) {
    name = $el.attr("title") || ""
  }

  if (!name || name.length < 3) return null

  // Extrair preco do texto visivel
  const containerText = $el.text()
  const priceMatch = containerText.match(/R\$\s*(\d+)[.,](\d{2})/)
  const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0

  // Extrair imagem
  const img = $el.find("img").first()
  let imageUrl = img.attr("src") || img.attr("data-src") || img.attr("data-lazy") || null
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = `${BASE_URL}${imageUrl}`
  }

  // Extrair URL do produto
  let productUrl = $el.attr("href") || $el.find("a").first().attr("href") || null
  if (productUrl && !productUrl.startsWith("http")) {
    productUrl = `${BASE_URL}${productUrl}`
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
 * Formata um numero como preco em Reais.
 */
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}
