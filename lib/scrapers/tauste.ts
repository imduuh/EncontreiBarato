/**
 * =============================================================================
 * SCRAPER DO TAUSTE SUPERMERCADOS
 * =============================================================================
 * 
 * O Tauste usa a plataforma Magento 2 para seu e-commerce.
 * A loja de Bauru esta em tauste.com.br/bauru/ (ou /marilia/ dependendo da regiao).
 * 
 * ESTRATEGIAS UTILIZADAS:
 * 1. Parse HTML da pagina de busca Magento
 * 2. JSON-LD structured data (fallback)
 * 3. Extracao generica de precos (ultimo recurso)
 * 
 * SELETORES MAGENTO 2:
 * - .product-item: container do produto
 * - .product-item-name: nome do produto
 * - [data-price-amount]: preco em atributo
 * - .price-wrapper .price: preco no texto
 */

import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import logger from "./logger"
import type { MarketProduct } from "./types"

// ============================================================================
// CONSTANTES E CONFIGURACAO
// ============================================================================

const MARKET_NAME = "Tauste"
const BASE_URL = "https://tauste.com.br"
const STORE_PATH = "/bauru"
const TIMEOUT_MS = 12000
const MAX_PRODUCTS = 10

// Headers para simular navegador
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  // Cookie para selecionar a loja correta
  "Cookie": "store=bauru",
}

// ============================================================================
// FUNCAO PRINCIPAL
// ============================================================================

/**
 * Funcao principal do scraper do Tauste.
 * Busca produtos na loja online usando Magento 2.
 * 
 * @param query - Termo de busca
 * @returns Lista de produtos encontrados
 */
export async function scrapeTauste(query: string): Promise<MarketProduct[]> {
  // URL de busca do Magento 2
  const searchUrl = `${BASE_URL}${STORE_PATH}/catalogsearch/result/?q=${encodeURIComponent(query)}`
  
  logger.info(MARKET_NAME, "Iniciando busca", { query })
  logger.request(MARKET_NAME, "GET", searchUrl)

  try {
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

    const $ = cheerio.load(html)

    // Debug: verificar estrutura da pagina
    const title = $("title").text()
    logger.debug(MARKET_NAME, "Titulo da pagina", { title })

    // Estrategia 1: Seletores padrao do Magento 2
    let products = extractMagentoProducts($)
    if (products.length > 0) {
      logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via seletores Magento`)
      return products.slice(0, MAX_PRODUCTS)
    }

    // Estrategia 2: JSON-LD structured data
    products = extractJsonLdProducts($)
    if (products.length > 0) {
      logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via JSON-LD`)
      return products.slice(0, MAX_PRODUCTS)
    }

    // Estrategia 3: Extracao generica
    products = extractGenericProducts($)
    if (products.length > 0) {
      logger.success(MARKET_NAME, `Encontrados ${products.length} produtos via extracao generica`)
      return products.slice(0, MAX_PRODUCTS)
    }

    logger.warn(MARKET_NAME, "Nenhum produto encontrado")
    return []

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na busca", error)
    throw error
  }
}

// ============================================================================
// ESTRATEGIAS DE EXTRACAO
// ============================================================================

/**
 * Estrategia 1: Seletores padrao do Magento 2.
 * Magento usa classes bem definidas para produtos.
 */
function extractMagentoProducts($: cheerio.CheerioAPI): MarketProduct[] {
  const products: MarketProduct[] = []

  // Seletores padrao do Magento 2
  const selectors = [
    "li.product-item",
    ".product-item-info",
    ".products-grid .product-item",
    ".product-items .item",
  ]

  // Debug: contar elementos
  for (const selector of selectors) {
    const count = $(selector).length
    if (count > 0) {
      logger.debug(MARKET_NAME, `Seletor "${selector}"`, { count })
    }
  }

  // Usar o primeiro seletor que encontrar elementos
  let $items = $("li.product-item")
  if ($items.length === 0) $items = $(".product-item-info")
  if ($items.length === 0) $items = $(".product-items .product-item")

  logger.info(MARKET_NAME, "Itens de produto encontrados", { count: $items.length })

  $items.each((_, el) => {
    if (products.length >= MAX_PRODUCTS) return false

    const product = parseMagentoProductCard($, el)
    if (product) products.push(product)
  })

  return products
}

/**
 * Parse de um card de produto Magento.
 */
function parseMagentoProductCard($: cheerio.CheerioAPI, el: Element): MarketProduct | null {
  const $el = $(el)

  // -------------------------------------------------------------------------
  // NOME DO PRODUTO
  // -------------------------------------------------------------------------
  let name = ""
  
  // Tentar varios seletores para o nome
  const nameSelectors = [
    ".product-item-name",
    ".product-name a",
    "h2 a",
    "h3 a",
    "a.product-item-link",
  ]
  
  for (const sel of nameSelectors) {
    const text = $el.find(sel).first().text().trim()
    if (text && text.length > 3) {
      name = text
      break
    }
  }

  // Fallback: usar atributo title do link
  if (!name) {
    name = $el.find("a[title]").first().attr("title") || ""
  }

  if (!name || name.length < 3) return null

  // -------------------------------------------------------------------------
  // PRECO
  // -------------------------------------------------------------------------
  let price = 0

  // Metodo 1: atributo data-price-amount (mais confiavel no Magento)
  const priceAmount = $el.find("[data-price-amount]").first().attr("data-price-amount")
  if (priceAmount) {
    price = parseFloat(priceAmount)
  }

  // Metodo 2: texto do elemento de preco
  if (price === 0) {
    const priceSelectors = [
      ".price-wrapper .price",
      ".price-box .price",
      ".special-price .price",
      ".regular-price .price",
      ".price",
    ]
    
    for (const sel of priceSelectors) {
      const priceText = $el.find(sel).first().text().trim()
      const match = priceText.match(/(\d+)[.,](\d{2})/)
      if (match) {
        price = parseFloat(`${match[1]}.${match[2]}`)
        break
      }
    }
  }

  // Metodo 3: buscar preco em qualquer texto do elemento
  if (price === 0) {
    const allText = $el.text()
    const priceMatch = allText.match(/R\$\s*(\d+)[.,](\d{2})/)
    if (priceMatch) {
      price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`)
    }
  }

  // -------------------------------------------------------------------------
  // IMAGEM
  // -------------------------------------------------------------------------
  const img = $el.find("img.product-image-photo, img.product-image, img").first()
  let imageUrl = img.attr("src") || img.attr("data-src") || img.attr("data-lazy") || null
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = `${BASE_URL}${imageUrl}`
  }

  // -------------------------------------------------------------------------
  // URL DO PRODUTO
  // -------------------------------------------------------------------------
  const linkEl = $el.find("a.product-item-link, a[href]").first()
  let productUrl = linkEl.attr("href") || null
  if (productUrl && !productUrl.startsWith("http")) {
    productUrl = `${BASE_URL}${productUrl}`
  }

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

/**
 * Estrategia 2: Extrair produtos de JSON-LD structured data.
 * Muitos sites incluem dados estruturados para SEO.
 */
function extractJsonLdProducts($: cheerio.CheerioAPI): MarketProduct[] {
  const products: MarketProduct[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    if (products.length >= MAX_PRODUCTS) return false

    try {
      const json = JSON.parse($(el).html() || "")
      
      // JSON-LD pode estar em @graph ou diretamente
      const items = json["@graph"] || (Array.isArray(json) ? json : [json])
      
      for (const item of items) {
        if (products.length >= MAX_PRODUCTS) break

        // Verificar se e um produto
        if (item["@type"] !== "Product" || !item.name) continue

        // Extrair preco das ofertas
        const offers = Array.isArray(item.offers) ? item.offers : [item.offers]
        for (const offer of offers) {
          if (!offer?.price) continue

          const price = parseFloat(offer.price)
          if (price > 0) {
            products.push({
              name: String(item.name).substring(0, 200),
              price,
              priceFormatted: formatPrice(price),
              imageUrl: item.image || null,
              productUrl: item.url || null,
              unit: null,
            })
            break // Apenas uma oferta por produto
          }
        }
      }
    } catch {
      // JSON invalido, ignorar
    }
  })

  return products
}

/**
 * Estrategia 3: Extracao generica.
 * Busca elementos que parecem ser produtos (nome + preco).
 */
function extractGenericProducts($: cheerio.CheerioAPI): MarketProduct[] {
  const products: MarketProduct[] = []

  // Procurar em containers genericos
  $("li, div.item, article, .product").each((_, el) => {
    if (products.length >= MAX_PRODUCTS) return false

    const $el = $(el)
    const text = $el.text()

    // Deve conter um preco
    const priceMatch = text.match(/R\$\s*(\d+)[.,](\d{2})/)
    if (!priceMatch) return

    // Deve conter um link com texto (nome do produto)
    const linkEl = $el.find("a").first()
    const name = linkEl.text().trim()

    // Validar nome
    if (!name || name.length < 5 || name.length > 200) return

    const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`)
    
    // Evitar duplicatas pelo nome
    if (products.some(p => p.name === name)) return

    let productUrl = linkEl.attr("href") || null
    if (productUrl && !productUrl.startsWith("http")) {
      productUrl = `${BASE_URL}${productUrl}`
    }

    const img = $el.find("img").first()
    let imageUrl = img.attr("src") || null
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `${BASE_URL}${imageUrl}`
    }

    products.push({
      name: name.substring(0, 200),
      price,
      priceFormatted: formatPrice(price),
      imageUrl,
      productUrl,
      unit: null,
    })
  })

  return products
}

/**
 * Formata um numero como preco em Reais.
 */
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}
