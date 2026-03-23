import logger from "./logger"
import type { MarketProduct, ScraperContext } from "./types"

const MARKET_NAME = "Barracao"
const HOST = "barracaosm.com.br"
const SERVICES_BASE_URL = "https://services.vipcommerce.com.br"
const API_BASE_URL = `${SERVICES_BASE_URL}/api-admin/v1`
const ORGANIZATIONS_BASE_URL = `${SERVICES_BASE_URL}/organizacoes`
const PRODUCT_IMAGE_BASE_URL = "https://produto-assets-vipcommerce-com-br.br-se1.magaluobjects.com/250x250"
const AUTH_USERNAME = "loja"
const AUTH_KEY = "df072f85df9bf7dd71b6811c34bdbaa4f219d98775b56cff9dfa5f8ca1bf8469"
const STOREFRONT_FILIAL_ID = 1
const STOREFRONT_DISTRIBUTION_CENTER_ID = 1
const MAX_PRODUCTS = 10
const TIMEOUT_MS = 15000
const SESSION_TTL_MS = 10 * 60 * 1000

interface OrganizationLookupResponse {
  success: boolean
  data?: {
    id: number
    organizacao: {
      id: number
      enderecoServidor: string
    }
  }
}

interface TokenResponse {
  success: boolean
  data?: string
}

interface SessionResponse {
  success: boolean
  data?: {
    sessao_id: string
  }
}

interface BarracaoSearchProduct {
  produto_id?: number
  descricao?: string
  link?: string
  imagem?: string
  preco?: number | string
  unidade_sigla?: string
  oferta?: {
    preco?: number | string
    preco_oferta?: number | string
    preco_antigo?: number | string
  }
}

interface BarracaoSearchResponse {
  success: boolean
  data?: {
    produtos?: BarracaoSearchProduct[]
  }
}

interface SessionContext {
  orgId: number
  domainKey: string
  token: string
  sessionId: string
  expiresAt: number
}

let cachedSession: SessionContext | null = null
let pendingSession: Promise<SessionContext> | null = null

export async function scrapeBarracao(query: string, context?: ScraperContext): Promise<MarketProduct[]> {
  const referenceCep = context?.region.referenceCep

  logger.info(MARKET_NAME, "Iniciando busca", {
    query,
    region: context?.region.label,
    referenceCep,
  })

  if (!referenceCep) {
    logger.warn(MARKET_NAME, "Busca ignorada por falta de CEP de referencia")
    return []
  }

  const session = await getSession()
  const products = await searchProducts(session, query)

  if (products.length === 0) {
    logger.warn(MARKET_NAME, "Nenhum produto retornado pelo catalogo principal", {
      query,
      region: context?.region.label,
      referenceCep,
      filialId: STOREFRONT_FILIAL_ID,
      distributionCenterId: STOREFRONT_DISTRIBUTION_CENTER_ID,
    })
    return []
  }

  logger.success(MARKET_NAME, `Encontrados ${products.length} produtos`, {
    region: context?.region.label,
    filialId: STOREFRONT_FILIAL_ID,
    distributionCenterId: STOREFRONT_DISTRIBUTION_CENTER_ID,
  })

  return products.slice(0, MAX_PRODUCTS)
}

async function getSession(): Promise<SessionContext> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession
  }

  if (pendingSession) {
    return pendingSession
  }

  pendingSession = createSession()

  try {
    cachedSession = await pendingSession
    return cachedSession
  } finally {
    pendingSession = null
  }
}

async function createSession(): Promise<SessionContext> {
  const organization = await requestJson<OrganizationLookupResponse>(
    "GET",
    `${ORGANIZATIONS_BASE_URL}/filiais/dominio/${HOST}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (!organization.data?.organizacao?.id || !organization.data.organizacao.enderecoServidor) {
    throw new Error("Nao foi possivel resolver a organizacao do Barracao.")
  }

  const orgId = organization.data.organizacao.id
  const domainKey = organization.data.organizacao.enderecoServidor
  const defaultHeaders = buildApiHeaders(orgId, domainKey)

  const tokenResponse = await requestJson<TokenResponse>(
    "POST",
    `${API_BASE_URL}/org/${orgId}/auth/loja/login`,
    {
      headers: defaultHeaders,
      body: JSON.stringify({
        domain: domainKey,
        username: AUTH_USERNAME,
        key: AUTH_KEY,
      }),
    }
  )

  if (!tokenResponse.data) {
    throw new Error("Nao foi possivel obter o token inicial do Barracao.")
  }

  const authHeaders = {
    ...defaultHeaders,
    Authorization: `Bearer ${tokenResponse.data}`,
  }

  const sessionResponse = await requestJson<SessionResponse>(
    "GET",
    `${API_BASE_URL}/org/${orgId}/loja/sessao_cliente`,
    { headers: authHeaders }
  )

  if (!sessionResponse.data?.sessao_id) {
    throw new Error("Nao foi possivel iniciar a sessao do Barracao.")
  }

  logger.debug(MARKET_NAME, "Sessao inicializada", {
    orgId,
    filialId: STOREFRONT_FILIAL_ID,
    distributionCenterId: STOREFRONT_DISTRIBUTION_CENTER_ID,
  })

  return {
    orgId,
    domainKey,
    token: tokenResponse.data,
    sessionId: sessionResponse.data.sessao_id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
}

async function searchProducts(session: SessionContext, query: string): Promise<MarketProduct[]> {
  const normalizedQuery = query.trim().replace(/[\\/\s%?=]/g, "+")
  const url = `${API_BASE_URL}/org/${session.orgId}/filial/${STOREFRONT_FILIAL_ID}/centro_distribuicao/${STOREFRONT_DISTRIBUTION_CENTER_ID}/loja/buscas/produtos/termo/${normalizedQuery}?page=1&&session=${session.sessionId}`

  const response = await requestJson<BarracaoSearchResponse>("GET", url, {
    headers: buildAuthenticatedHeaders(session),
  })

  return (response.data?.produtos || [])
    .map((product) => mapProduct(product))
    .filter((product): product is MarketProduct => product !== null)
}

function mapProduct(product: BarracaoSearchProduct): MarketProduct | null {
  const name = product.descricao?.trim()
  if (!name) {
    return null
  }

  const basePrice = normalizePrice(product.preco)
  const offerPrice = normalizePrice(product.oferta?.preco_oferta ?? product.oferta?.preco)
  const finalPrice = offerPrice > 0 && (basePrice <= 0 || offerPrice < basePrice)
    ? offerPrice
    : basePrice

  return {
    name: name.substring(0, 200),
    price: finalPrice,
    priceFormatted: finalPrice > 0 ? formatPrice(finalPrice) : "Preco indisponivel",
    imageUrl: normalizeImageUrl(product.imagem),
    productUrl: buildProductUrl(product),
    unit: product.unidade_sigla?.trim() || null,
  }
}

function buildProductUrl(product: BarracaoSearchProduct): string | null {
  if (typeof product.link === "string" && product.link.trim().length > 0) {
    const slug = product.link.replace(/^\/+/, "").trim()
    if (!slug) {
      return null
    }

    if (product.produto_id) {
      return `https://${HOST}/produto/${product.produto_id}/${slug}`
    }

    return `https://${HOST}/produto/${slug}`
  }

  if (!product.produto_id || !product.descricao) {
    return null
  }

  return `https://${HOST}/produto/${product.produto_id}/${slugify(product.descricao)}`
}

function normalizeImageUrl(value?: string): string | null {
  if (!value) {
    return null
  }

  if (value.startsWith("http")) {
    return value
  }

  if (value.startsWith("//")) {
    return `https:${value}`
  }

  if (value.startsWith("/")) {
    return `https://${HOST}${value}`
  }

  return `${PRODUCT_IMAGE_BASE_URL}/${value}`
}

function normalizePrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."))
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 0
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildApiHeaders(orgId: number, domainKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    DomainKey: domainKey,
    OrganizationId: String(orgId),
  }
}

function buildAuthenticatedHeaders(session: SessionContext): Record<string, string> {
  return {
    ...buildApiHeaders(session.orgId, session.domainKey),
    Authorization: `Bearer ${session.token}`,
    "sessao-id": session.sessionId,
  }
}

async function requestJson<T>(method: string, url: string, init: RequestInit): Promise<T> {
  logger.request(MARKET_NAME, method, url)

  const response = await fetch(url, {
    ...init,
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  logger.response(MARKET_NAME, response.status)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}
