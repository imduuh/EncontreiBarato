/**
 * =============================================================================
 * SCRAPER DO ATACADAO
 * =============================================================================
 * 
 * O Atacadao usa a plataforma VTEX para seu e-commerce.
 * VTEX oferece varias APIs para busca de produtos.
 * 
 * ESTRATEGIAS UTILIZADAS:
 * 1. Intelligent Search API (mais moderna e completa)
 * 2. GraphQL endpoint (alternativa)
 * 3. Catalog API legacy (fallback)
 * 
 * PRECOS POR QUANTIDADE:
 * O Atacadao oferece descontos para compras em quantidade.
 * Esses descontos sao armazenados em "Teasers" dentro de "commertialOffer".
 * Exemplo: "Leve 3 e pague R$ 10,00 cada"
 * 
 * CONFIGURACAO:
 * - CEP de Bauru: 17014900 /
 * - O CEP e necessario para configurar a sessao e ver precos corretos
 */

import logger from "./logger"
import type { MarketProduct, BulkPrice, ScraperContext } from "./types"

// ============================================================================
// CONSTANTES E CONFIGURACAO
// ============================================================================

const MARKET_NAME = "Atacadao"
const BASE_URL = "https://www.atacadao.com.br"
const DEFAULT_CEP = "17014900" // CEP da Prefeitura de Bauru.
const TIMEOUT_MS = 8000
const MAX_PRODUCTS = 10

// Headers para simular navegador
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Origin": BASE_URL,
  "Referer": `${BASE_URL}/`,
}

// ============================================================================
// FUNCAO PRINCIPAL
// ============================================================================

/**
 * Funcao principal do scraper do Atacadao.
 * Busca produtos e extrai precos normais e com desconto por quantidade.
 * 
 * @param query - Termo de busca
 * @returns Lista de produtos encontrados
 */
export async function scrapeAtacadao(query: string, context?: ScraperContext): Promise<MarketProduct[]> {
  logger.info(MARKET_NAME, "Iniciando busca", { query })

  try {
    // Passo 1: Configurar sessao com CEP de Bauru
    const sessionCookies = await setupSession(context)

    // Passo 2: Buscar produtos usando as APIs disponiveis
    const products = await searchProducts(query, sessionCookies)
    const enrichedProducts = await enrichProductsWithBulkPricing(products, sessionCookies)

    if (enrichedProducts.length > 0) {
      logger.success(MARKET_NAME, `Encontrados ${enrichedProducts.length} produtos`)
      return enrichedProducts.slice(0, MAX_PRODUCTS)
    }

    logger.warn(MARKET_NAME, "Nenhum produto encontrado")
    return []

  } catch (error) {
    logger.error(MARKET_NAME, "Erro na busca", error)
    throw error
  }
}

// ============================================================================
// CONFIGURACAO DE SESSAO
// ============================================================================

/**
 * Configura a sessao do VTEX com o CEP de Bauru.
 * Isso e necessario para obter precos corretos da regiao.
 * 
 * @returns String com cookies para usar nas requisicoes
 */
async function setupSession(context?: ScraperContext): Promise<string> {
  const cep = context?.region.referenceCep || DEFAULT_CEP

  logger.info(MARKET_NAME, "Configurando sessao", { cep })

  const cookies: string[] = []

  try {
    // 1. Acessar pagina inicial para obter cookies basicos
    const homeResponse = await fetch(BASE_URL, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })

    // Extrair cookies da resposta
    const homeCookies = homeResponse.headers.getSetCookie?.() || []
    for (const cookie of homeCookies) {
      cookies.push(cookie.split(";")[0])
    }

    // 2. Configurar localizacao via API de sessao do VTEX
    const sessionPayload = {
      public: {
        postalCode: { value: cep },
        country: { value: "BRA" },
        geoCoordinates: { value: null },
      },
    }

    const sessionResponse = await fetch(`${BASE_URL}/api/sessions`, {
      method: "PATCH",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/json",
        Cookie: cookies.join("; "),
      },
      body: JSON.stringify(sessionPayload),
      signal: AbortSignal.timeout(5000),
    })

    // Adicionar cookies da sessao
    const sessionCookies = sessionResponse.headers.getSetCookie?.() || []
    for (const cookie of sessionCookies) {
      cookies.push(cookie.split(";")[0])
    }

    logger.success(MARKET_NAME, "Sessao configurada")

  } catch (error) {
    logger.warn(MARKET_NAME, "Erro ao configurar sessao, continuando sem CEP", error)
  }

  // Adicionar cookie vtex_segment com informacoes de regiao
  const segmentData = {
    utm_campaign: null,
    utm_source: null,
    utmi_campaign: null,
    currencyCode: "BRL",
    currencySymbol: "R$",
    countryCode: "BRA",
    postalCode: cep,
    regionId: null,
    cultureInfo: "pt-BR",
    channelPrivacy: "public",
  }
  const vtexSegment = Buffer.from(JSON.stringify(segmentData)).toString("base64")
  cookies.push(`vtex_segment=${vtexSegment}`)
  cookies.push("vtex_locale=pt-BR")

  return cookies.join("; ")
}

// ============================================================================
// BUSCA DE PRODUTOS
// ============================================================================

/**
 * Busca produtos usando as APIs do VTEX.
 * Tenta multiplas estrategias em ordem de preferencia.
 * 
 * @param query - Termo de busca
 * @param cookies - Cookies da sessao
 * @returns Lista de produtos encontrados
 */
async function searchProducts(query: string, cookies: string): Promise<MarketProduct[]> {
  let products: MarketProduct[] = []

  // Estrategia 1: Intelligent Search API (mais moderna)
  products = await tryIntelligentSearch(query, cookies)
  if (products.length > 0) return products

  // Estrategia 2: GraphQL endpoint
  products = await tryGraphQLSearch(query, cookies)
  if (products.length > 0) return products

  // Estrategia 3: Catalog API (legacy)
  products = await tryCatalogSearch(query, cookies)
  return products
}

/**
 * Estrategia 1: VTEX Intelligent Search API
 * API moderna com suporte a busca inteligente.
 */
async function tryIntelligentSearch(query: string, cookies: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/api/io/_v/api/intelligent-search/product_search/${encodeURIComponent(query)}?page=1&count=${MAX_PRODUCTS}&sort=score_desc&locale=pt-BR`

  logger.request(MARKET_NAME, "GET", url)

  try {
    const response = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: cookies,
        "X-VTEX-Locale": "pt-BR",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const data = await response.json()
    const productList = data.products || []

    logger.debug(MARKET_NAME, "Intelligent Search retornou", { count: productList.length })

    for (const item of productList) {
      if (products.length >= MAX_PRODUCTS) break
      const parsed = parseVtexProduct(item)
      if (parsed) products.push(parsed)
    }

  } catch (error) {
    logger.warn(MARKET_NAME, "Intelligent Search falhou", error)
  }

  return products
}

/**
 * Estrategia 2: VTEX GraphQL Search
 * API GraphQL para busca de produtos.
 * Atualmente não está funcionando.
 */
async function tryGraphQLSearch(query: string, cookies: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/_v/segment/graphql/v1?workspace=master`

  // Query GraphQL para busca de produtos
  const graphqlBody = {
    operationName: "productSearchV3",
    variables: {
      fullText: query,
      from: 0,
      to: MAX_PRODUCTS - 1,
      selectedFacets: [],
      operator: "and",
      fuzzy: "auto",
      orderBy: "OrderByScoreDESC",
      hideUnavailableItems: false,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "9177ba6f883473505dc99fcf2b679a57dc09711a8c5c24586bb4dc6d5e6e8070",
        sender: "vtex.store-resources@0.x",
        provider: "vtex.search-graphql@0.x",
      },
    },
  }

  logger.request(MARKET_NAME, "POST", url)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify(graphqlBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const data = await response.json()
    const productList = data?.data?.productSearch?.products || []

    logger.debug(MARKET_NAME, "GraphQL retornou", { count: productList.length })

    for (const item of productList) {
      if (products.length >= MAX_PRODUCTS) break
      const parsed = parseVtexProduct(item)
      if (parsed) products.push(parsed)
    }

  } catch (error) {
    logger.warn(MARKET_NAME, "GraphQL Search falhou", error)
  }

  return products
}

/**
 * Estrategia 3: VTEX Catalog API (Legacy)
 * API mais antiga, mas ainda funcional.
 */
async function tryCatalogSearch(query: string, cookies: string): Promise<MarketProduct[]> {
  const products: MarketProduct[] = []
  const url = `${BASE_URL}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=${MAX_PRODUCTS - 1}`

  logger.request(MARKET_NAME, "GET", url)

  try {
    const response = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: cookies,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) return products

    const data = await response.json()

    if (Array.isArray(data)) {
      logger.debug(MARKET_NAME, "Catalog API retornou", { count: data.length })

      for (const item of data) {
        if (products.length >= MAX_PRODUCTS) break
        const parsed = parseVtexProduct(item)
        if (parsed) products.push(parsed)
      }
    }

  } catch (error) {
    logger.warn(MARKET_NAME, "Catalog Search falhou", error)
  }

  return products
}

// ============================================================================
// PARSING DE PRODUTOS
// ============================================================================

/**
 * Converte um produto do formato VTEX para MarketProduct.
 * Extrai informacoes basicas e precos com desconto por quantidade.
 * 
 * @param item - Objeto do produto no formato VTEX
 * @returns MarketProduct ou null se invalido
 */
function parseVtexProduct(item: unknown): MarketProduct | null {
  if (!item || typeof item !== "object") return null

  const product = item as Record<string, unknown>

  // -------------------------------------------------------------------------
  // NOME DO PRODUTO
  // -------------------------------------------------------------------------
  const name = String(product.productName || product.name || "").trim()
  if (!name) return null

  // -------------------------------------------------------------------------
  // ITEMS/SKUS
  // -------------------------------------------------------------------------
  // VTEX armazena variacoes do produto em "items"
  const items = product.items as Array<Record<string, unknown>> | undefined
  const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null

  // -------------------------------------------------------------------------
  // PRECOS E DESCONTO POR QUANTIDADE
  // -------------------------------------------------------------------------
  let price = 0
  let bulkPrice: BulkPrice | undefined

  if (firstItem) {
    // Sellers contem as ofertas comerciais
    const sellers = firstItem.sellers as Array<Record<string, unknown>> | undefined
    
    if (Array.isArray(sellers) && sellers.length > 0) {
      for (const seller of sellers) {
        const offer = seller.commertialOffer as Record<string, unknown> | undefined
        
        if (offer) {
          // Preco normal (pode ser Price, spotPrice, ou ListPrice)
          price = extractPrice(offer)
          
          // Verificar descontos por quantidade (Teasers)
          bulkPrice = extractBulkPrice(offer, price)
          
          if (price > 0) break
        }
      }
    }
  }

  // Fallback: priceRange (usado em algumas APIs)
  if (price === 0) {
    const priceRange = product.priceRange as Record<string, unknown> | undefined
    if (priceRange) {
      const sellingPrice = priceRange.sellingPrice as Record<string, unknown> | undefined
      price = (sellingPrice?.lowPrice as number) || (sellingPrice?.highPrice as number) || 0

      if (price === 0) {
        const listPrice = priceRange.listPrice as Record<string, unknown> | undefined
        price = (listPrice?.lowPrice as number) || (listPrice?.highPrice as number) || 0
      }
    }
  }

  // -------------------------------------------------------------------------
  // IMAGEM
  // -------------------------------------------------------------------------
  let imageUrl: string | null = null

  // Tentar pegar do primeiro item/SKU
  if (firstItem) {
    const images = firstItem.images as Array<Record<string, unknown>> | undefined
    if (Array.isArray(images) && images.length > 0) {
      imageUrl = (images[0].imageUrl as string) || null
    }
  }

  // Fallback: imagem do produto principal
  if (!imageUrl) {
    imageUrl = (product.imageUrl as string) || (product.image as string) || null
    
    const productImages = product.images as Array<Record<string, unknown>> | undefined
    if (!imageUrl && Array.isArray(productImages) && productImages.length > 0) {
      imageUrl = (productImages[0].imageUrl as string) || null
    }
  }

  // -------------------------------------------------------------------------
  // URL DO PRODUTO
  // -------------------------------------------------------------------------
  let productUrl: string | null = null
  const link = (product.link as string) || (product.linkText as string) || (product.slug as string) || ""
  
  if (link) {
    if (link.startsWith("http")) {
      productUrl = link
    } else if (link.startsWith("/")) {
      productUrl = `${BASE_URL}${link}`
    } else {
      productUrl = `${BASE_URL}/${link}/p`
    }
  }

  // -------------------------------------------------------------------------
  // RETORNAR PRODUTO FORMATADO
  // -------------------------------------------------------------------------
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

/**
 * Enriquece os produtos com os precos reais da pagina do produto.
 * O Atacadao nem sempre retorna o preco de atacado nas APIs de busca.
 */
async function enrichProductsWithBulkPricing(
  products: MarketProduct[],
  cookies: string
): Promise<MarketProduct[]> {
  return Promise.all(
    products.map(async (product) => {
      // Se a busca regionalizada ja marcou o item como indisponivel,
      // nao devemos sobrescrever isso com a PDP, que pode responder com outro seller.
      if (!product.productUrl || product.price <= 0) {
        return product
      }

      try {
        const pagePricing = await fetchProductPagePricing(product.productUrl, cookies)
        if (!pagePricing) {
          return product
        }

        return {
          ...product,
          price: pagePricing.price > 0 ? pagePricing.price : product.price,
          priceFormatted:
            pagePricing.price > 0 ? formatPrice(pagePricing.price) : product.priceFormatted,
          bulkPrice: pagePricing.bulkPrice ?? product.bulkPrice,
        }
      } catch (error) {
        logger.warn(MARKET_NAME, "Falha ao enriquecer produto com preco da pagina", {
          product: product.name,
          error,
        })
        return product
      }
    })
  )
}

/**
 * Le os precos exibidos na pagina do produto.
 * O estado __NEXT_DATA__ contem uma lista de ofertas com minQuantity.
 */
async function fetchProductPagePricing(
  productUrl: string,
  cookies: string
): Promise<{ price: number; bulkPrice?: BulkPrice } | null> {
  logger.request(MARKET_NAME, "GET", productUrl)

  const response = await fetch(productUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: cookies,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  logger.response(MARKET_NAME, response.status)

  if (!response.ok) {
    return null
  }

  const html = await response.text()
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) {
    return null
  }

  const nextData = JSON.parse(match[1]) as {
    props?: {
      pageProps?: {
        product?: {
          sku?: string | number
          offers?: unknown
          sellers?: unknown
        }
      }
    }
  }

  const productData = nextData.props?.pageProps?.product
  const offers = extractOffersFromProductPageData(productData)
  const normalizedPagePricing = normalizePageOffersPricing(offers)

  if (normalizedPagePricing) {
    return normalizedPagePricing
  }

  const skuId = String(productData?.sku || "").trim()
  const sellerIdentifier = extractProductPageSellerIdentifier(productData)
  if (!skuId) {
    return null
  }

  return fetchSimulationPricingBySku(skuId, cookies, sellerIdentifier || "1")
}

type ProductPageOffer = {
  availability?: string
  price?: number
  listPrice?: number
  minQuantity?: number
  seller?: {
    identifier?: string
  }
}

function extractOffersFromProductPageData(productData: unknown): ProductPageOffer[] {
  const candidates: ProductPageOffer[][] = []

  function visit(node: unknown, depth = 0) {
    if (!node || depth > 6) return

    if (Array.isArray(node)) {
      if (node.every(isProductPageOfferCandidate)) {
        candidates.push(node as ProductPageOffer[])
      }

      for (const item of node) {
        visit(item, depth + 1)
      }
      return
    }

    if (typeof node !== "object") return

    for (const value of Object.values(node as Record<string, unknown>)) {
      visit(value, depth + 1)
    }
  }

  visit(productData)

  const bestMatch = candidates
    .map((offers) =>
      offers
        .filter((offer) => typeof offer.price === "number" && offer.price > 0)
        .sort((a, b) => (a.minQuantity || 1) - (b.minQuantity || 1))
    )
    .filter((offers) => offers.length > 0)
    .sort((a, b) => b.length - a.length)[0]

  return bestMatch || []
}

function extractProductPageSellerIdentifier(productData: unknown): string | null {
  if (!productData || typeof productData !== "object") {
    return null
  }

  const record = productData as Record<string, unknown>
  const offersContainer = record.offers as Record<string, unknown> | undefined
  const rawOffers = offersContainer?.offers

  if (!Array.isArray(rawOffers)) {
    return null
  }

  for (const offer of rawOffers) {
    if (!offer || typeof offer !== "object") continue

    const seller = (offer as Record<string, unknown>).seller
    if (!seller || typeof seller !== "object") continue

    const identifier = (seller as Record<string, unknown>).identifier
    if (typeof identifier === "string" && identifier.trim().length > 0) {
      return identifier.trim()
    }
  }

  return null
}

function normalizePageOffersPricing(
  offers: ProductPageOffer[]
): { price: number; bulkPrice?: BulkPrice } | null {
  if (!Array.isArray(offers) || offers.length === 0) {
    return null
  }

  const availableOffers = offers
    .filter((offer) => offer?.availability === "available")
    .filter((offer) => typeof offer.price === "number" && offer.price > 0)
    .sort((a, b) => (a.minQuantity || 1) - (b.minQuantity || 1))

  if (availableOffers.length === 0) {
    return null
  }

  const baseOffer =
    availableOffers.find((offer) => (offer.minQuantity || 1) <= 1) || availableOffers[0]
  const bulkOffer = availableOffers.find(
    (offer) =>
      (offer.minQuantity || 1) > 1 &&
      typeof offer.price === "number" &&
      offer.price < (baseOffer.price || 0)
  )

  return {
    price: baseOffer.price || 0,
    bulkPrice: bulkOffer
      ? {
          price: bulkOffer.price || 0,
          minQuantity: bulkOffer.minQuantity || 0,
          priceFormatted: formatPrice(bulkOffer.price || 0),
          description: `A partir de ${bulkOffer.minQuantity} unidades`,
        }
      : undefined,
  }
}

function isProductPageOfferCandidate(value: unknown): value is ProductPageOffer {
  if (!value || typeof value !== "object") return false

  const record = value as Record<string, unknown>
  const hasPrice =
    (typeof record.price === "number" && record.price > 0)
    || (typeof record.listPrice === "number" && record.listPrice > 0)

  const hasOfferShape =
    "minQuantity" in record
    || "availability" in record
    || "sellerId" in record
    || "sellerName" in record

  return hasPrice && hasOfferShape
}

async function fetchSimulationPricingBySku(
  skuId: string,
  cookies: string,
  sellerId: string
): Promise<{ price: number; bulkPrice?: BulkPrice } | null> {
  const quantitiesToProbe = [1, 2, 3, 4, 6, 12]
  const probedPrices = new Map<number, number>()

  for (const quantity of quantitiesToProbe) {
    const simulation = await simulateSkuPricing(skuId, quantity, cookies, sellerId)
    const unitPrice = simulation?.unitPrice ?? null

    if (unitPrice && unitPrice > 0) {
      probedPrices.set(quantity, unitPrice)
    }
  }

  const basePrice = probedPrices.get(1)
  if (!basePrice) {
    return null
  }

  const bulkEntry = [...probedPrices.entries()].find(
    ([quantity, unitPrice]) => quantity > 1 && unitPrice < basePrice
  )

  logger.debug(MARKET_NAME, "Preco obtido via simulacao de checkout", {
    skuId,
    sellerId,
    prices: Object.fromEntries(probedPrices),
  })

  return {
    price: basePrice,
    bulkPrice: bulkEntry
      ? {
          price: bulkEntry[1],
          minQuantity: bulkEntry[0],
          priceFormatted: formatPrice(bulkEntry[1]),
          description: `A partir de ${bulkEntry[0]} unidades`,
        }
      : undefined,
  }
}

async function simulateSkuPricing(
  skuId: string,
  quantity: number,
  cookies: string,
  sellerId: string
): Promise<{ unitPrice: number | null } | null> {
  const url = `${BASE_URL}/api/checkout/pub/orderForms/simulation?sc=1`

  logger.request(MARKET_NAME, "POST", url)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        items: [{ id: skuId, quantity, seller: sellerId }],
        country: "BRA",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    logger.response(MARKET_NAME, response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json() as {
      items?: Array<{ price?: number | null }>
      purchaseConditions?: {
        itemPurchaseConditions?: Array<{
          price?: number | null
        }>
      }
    }

    const directItemPrice = data.items?.[0]?.price
    if (typeof directItemPrice === "number" && directItemPrice > 0) {
      return { unitPrice: directItemPrice / 100 }
    }

    const fallbackPrice = data.purchaseConditions?.itemPurchaseConditions
      ?.map((condition) => condition.price)
      .filter((price): price is number => typeof price === "number" && price > 0)
      .sort((a, b) => a - b)[0]

    return {
      unitPrice: typeof fallbackPrice === "number" ? fallbackPrice / 100 : null,
    }
  } catch (error) {
    logger.warn(MARKET_NAME, "Falha ao simular preco do SKU", {
      skuId,
      quantity,
      sellerId,
      error,
    })
    return null
  }
}

/**
 * Extrai o preco de uma oferta comercial VTEX.
 * 
 * @param offer - Objeto commertialOffer do VTEX
 * @returns Preco em numero ou 0 se nao encontrado
 */
function extractPrice(offer: Record<string, unknown>): number {
  // Ordem de preferencia: spotPrice > Price > ListPrice
  const priceFields = ["spotPrice", "Price", "ListPrice", "sellingPrice", "price"]
  
  for (const field of priceFields) {
    const value = offer[field]
    if (typeof value === "number" && value > 0) {
      return value
    }
  }
  
  return 0
}

/**
 * Extrai informacoes de desconto por quantidade dos Teasers.
 * 
 * No VTEX, descontos por quantidade sao armazenados em "Teasers".
 * Cada Teaser pode ter:
 * - Nome/condicao (ex: "Leve 3 ou mais")
 * - Efeitos (desconto percentual ou valor fixo)
 * 
 * @param offer - Objeto commertialOffer do VTEX
 * @param basePrice - Preco base do produto
 * @returns BulkPrice ou undefined se nao houver desconto
 */
function extractBulkPrice(offer: Record<string, unknown>, basePrice: number): BulkPrice | undefined {
  const teasers = offer.Teasers as Array<Record<string, unknown>> | undefined
  
  if (!Array.isArray(teasers) || teasers.length === 0) {
    return undefined
  }

  // Procurar por teasers de desconto por quantidade
  for (const teaser of teasers) {
    try {
      // Estrutura do Teaser no VTEX:
      // {
      //   "<Name>k__BackingField": "Leve 3 ou mais",
      //   "<Effects>k__BackingField": {
      //     "<Parameters>k__BackingField": [
      //       { "<Name>k__BackingField": "MinQuantity", "<Value>k__BackingField": "3" },
      //       { "<Name>k__BackingField": "PercentualDiscount", "<Value>k__BackingField": "10" }
      //     ]
      //   }
      // }

      // Acessar os efeitos do teaser
      const effects = (
        teaser["<Effects>k__BackingField"] ||
        teaser.Effects ||
        teaser.effects
      ) as Record<string, unknown> | undefined

      if (!effects) continue

      // Acessar os parametros
      const parameters = (
        effects["<Parameters>k__BackingField"] ||
        effects.Parameters ||
        effects.parameters
      ) as Array<Record<string, unknown>> | undefined

      if (!Array.isArray(parameters)) continue

      // Extrair quantidade minima e desconto
      let minQuantity = 0
      let discountPercent = 0
      let discountValue = 0

      for (const param of parameters) {
        const paramName = String(
          param["<Name>k__BackingField"] ||
          param.Name ||
          param.name ||
          ""
        ).toLowerCase()

        const paramValue = String(
          param["<Value>k__BackingField"] ||
          param.Value ||
          param.value ||
          "0"
        )

        if (paramName.includes("minquantity") || paramName.includes("quantity")) {
          minQuantity = parseInt(paramValue, 10) || 0
        }
        
        if (paramName.includes("percentualdiscount") || paramName.includes("percent")) {
          discountPercent = parseFloat(paramValue) || 0
        }
        
        if (paramName.includes("nominaldiscount") || paramName.includes("value")) {
          discountValue = parseFloat(paramValue) || 0
        }
      }

      // Calcular preco com desconto
      if (minQuantity > 0 && (discountPercent > 0 || discountValue > 0)) {
        let bulkPriceValue = basePrice

        if (discountPercent > 0) {
          // Desconto percentual (ex: 10% de desconto)
          bulkPriceValue = basePrice * (1 - discountPercent / 100)
        } else if (discountValue > 0) {
          // Desconto em valor (ex: R$ 5,00 de desconto)
          bulkPriceValue = basePrice - discountValue
        }

        // Garantir que o preco nao fique negativo
        bulkPriceValue = Math.max(0, bulkPriceValue)

        // So retornar se o preco com desconto for menor que o preco base
        if (bulkPriceValue < basePrice) {
          logger.debug(MARKET_NAME, "Desconto por quantidade encontrado", {
            minQuantity,
            discountPercent,
            discountValue,
            basePrice,
            bulkPriceValue,
          })

          return {
            price: bulkPriceValue,
            minQuantity,
            priceFormatted: formatPrice(bulkPriceValue),
          }
        }
      }

    } catch (error) {
      // Ignorar erros de parsing de teasers individuais
      continue
    }
  }

  return undefined
}

/**
 * Formata um numero como preco em Reais.
 */
function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}
