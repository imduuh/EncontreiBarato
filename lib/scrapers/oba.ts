import logger from "./logger"
import type { MarketProduct, ScraperContext } from "./types"

const MARKET_NAME = "Oba"
const BASE_URL = "https://www.obahortifruti.com.br"
const MAX_PRODUCTS = 10
const TIMEOUT_MS = 10000

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Referer": `${BASE_URL}/oba`,
  "Origin": BASE_URL,
}

interface ObaRegionSeller {
  id?: string
  name?: string
}

interface ObaRegion {
  id?: string
  sellers?: ObaRegionSeller[]
}

interface ObaImage {
  imageUrl?: string
}

interface ObaCommercialOffer {
  Price?: number
  ListPrice?: number
  AvailableQuantity?: number
}

interface ObaSeller {
  commertialOffer?: ObaCommercialOffer
}

interface ObaItem {
  itemId?: string
  ean?: string
  measurementUnit?: string
  unitMultiplier?: number
  images?: ObaImage[]
  sellers?: ObaSeller[]
}

interface ObaSearchProduct {
  productName?: string
  link?: string
  items?: ObaItem[]
}

interface ObaSearchResponse {
  products?: ObaSearchProduct[]
}

export async function scrapeOba(query: string, context?: ScraperContext): Promise<MarketProduct[]> {
  const referenceCep = context?.region.referenceCep

  logger.info(MARKET_NAME, "Iniciando busca", {
    query,
    region: context?.region.label,
    referenceCep,
  })

  if (!referenceCep) {
    logger.warn(MARKET_NAME, "Busca ignorada por falta de CEP de referencia", {
      region: context?.region.label,
    })
    return []
  }

  const region = await resolveRegion(referenceCep, context)
  const products = await searchProducts(query, region.id)

  logger.success(MARKET_NAME, `Encontrados ${products.length} produtos`, {
    query,
    region: context?.region.label,
    referenceCep,
    regionId: region.id,
    sellerId: region.primarySellerId,
  })

  return products.slice(0, MAX_PRODUCTS)
}

async function resolveRegion(
  postalCode: string,
  context?: ScraperContext
): Promise<{ id: string; primarySellerId: string | null }> {
  const url = `${BASE_URL}/api/checkout/pub/regions?country=BRA&postalCode=${postalCode}`

  logger.request(MARKET_NAME, "GET", url)

  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  logger.response(MARKET_NAME, response.status)

  if (!response.ok) {
    throw new Error(`Falha ao resolver regiao do Oba (${response.status}).`)
  }

  const data = await response.json() as ObaRegion[]
  const region = data[0]

  if (!region?.id) {
    throw new Error("O Oba nao retornou um regionId valido para a localidade informada.")
  }

  const preferredSeller = pickPreferredSeller(region.sellers || [], context)
  const primarySellerId = preferredSeller?.id || region.sellers?.[0]?.id || null

  logger.debug(MARKET_NAME, "Regiao resolvida", {
    postalCode,
    regionId: region.id,
    sellerId: primarySellerId,
    sellerName: preferredSeller?.name || region.sellers?.[0]?.name || null,
  })

  return {
    id: region.id,
    primarySellerId,
  }
}

async function searchProducts(query: string, regionId: string): Promise<MarketProduct[]> {
  const searchQuery = encodeURIComponent(query.trim())
  const url = `${BASE_URL}/api/io/_v/api/intelligent-search/product_search?page=1&count=${MAX_PRODUCTS}&query=${searchQuery}&locale=pt-BR`
  const cookies = buildCookies(regionId)

  logger.request(MARKET_NAME, "GET", url)

  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Cookie: cookies,
      "X-VTEX-Locale": "pt-BR",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  logger.response(MARKET_NAME, response.status)

  if (!response.ok) {
    throw new Error(`Falha ao buscar produtos no Oba (${response.status}).`)
  }

  const data = await response.json() as ObaSearchResponse

  return (data.products || [])
    .map((product) => mapProduct(product))
    .filter((product): product is MarketProduct => product !== null)
}

function mapProduct(product: ObaSearchProduct): MarketProduct | null {
  const name = product.productName?.trim()
  const item = product.items?.[0]
  const offer = item?.sellers?.[0]?.commertialOffer

  if (!name || !item) {
    return null
  }

  const price = normalizePrice(offer?.Price)
  const listPrice = normalizePrice(offer?.ListPrice)
  const availableQuantity = typeof offer?.AvailableQuantity === "number" ? offer.AvailableQuantity : 0
  const available = availableQuantity > 0 && price > 0

  return {
    name: name.substring(0, 200),
    price: available ? price : 0,
    priceFormatted: available ? formatPrice(price) : "Indisponivel",
    imageUrl: item.images?.[0]?.imageUrl || null,
    productUrl: buildProductUrl(product.link),
    unit: formatUnit(item.measurementUnit, item.unitMultiplier, listPrice, price),
  }
}

function buildProductUrl(link?: string): string | null {
  if (!link) {
    return null
  }

  if (link.startsWith("http")) {
    return link
  }

  return `${BASE_URL}${link.startsWith("/") ? link : `/${link}`}`
}

function buildCookies(regionId: string): string {
  const segment = Buffer.from(JSON.stringify({
    campaigns: null,
    channel: "1",
    priceTables: null,
    regionId,
    utm_campaign: null,
    utm_source: null,
    utmi_campaign: null,
    currencyCode: "BRL",
    currencySymbol: "R$",
    countryCode: "BRA",
    cultureInfo: "pt-BR",
    channelPrivacy: "public",
  })).toString("base64")

  return `vtex_segment=${segment}; vtex_locale=pt-BR`
}

function pickPreferredSeller(
  sellers: ObaRegionSeller[],
  context?: ScraperContext
): ObaRegionSeller | null {
  if (sellers.length === 0) {
    return null
  }

  const regionLabel = normalizeText(context?.region.label)
  const regionCity = normalizeText(context?.region.city)
  const regionTokens = new Set(
    [regionLabel, regionCity]
      .flatMap((value) => value.split(" "))
      .map((value) => value.trim())
      .filter((value) => value.length >= 4)
  )

  for (const seller of sellers) {
    const normalizedSellerName = normalizeText(`${seller.name || ""} ${seller.id || ""}`)
    if ([...regionTokens].some((token) => normalizedSellerName.includes(token))) {
      return seller
    }
  }

  return sellers[0]
}

function formatUnit(
  measurementUnit?: string,
  unitMultiplier?: number,
  listPrice?: number,
  price?: number
): string | null {
  const normalizedMeasurementUnit = measurementUnit?.trim()

  if (!normalizedMeasurementUnit) {
    return null
  }

  if (typeof unitMultiplier === "number" && Number.isFinite(unitMultiplier) && unitMultiplier !== 1) {
    return `${unitMultiplier}${normalizedMeasurementUnit}`
  }

  if (listPrice === price && normalizedMeasurementUnit.length > 0) {
    return normalizedMeasurementUnit
  }

  return normalizedMeasurementUnit
}

function normalizePrice(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0
  }

  return value
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function normalizeText(value?: string): string {
  if (!value) {
    return ""
  }

  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
