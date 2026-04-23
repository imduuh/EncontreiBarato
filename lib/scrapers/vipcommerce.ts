import logger from "./logger"
import type { MarketProduct } from "./types"

const SERVICES_BASE_URL = "https://services.vipcommerce.com.br"
const API_BASE_URL = `${SERVICES_BASE_URL}/api-admin/v1`
const ORGANIZATIONS_BASE_URL = `${SERVICES_BASE_URL}/organizacoes`
const PRODUCT_IMAGE_BASE_URL =
  "https://produto-assets-vipcommerce-com-br.br-se1.magaluobjects.com/250x250"
const DEFAULT_AUTH_USERNAME = "loja"

type OrganizationLookupResponse = {
  success: boolean
  data?: {
    id: number
    organizacao: {
      id: number
      enderecoServidor: string
    }
  }
}

type TokenResponse = {
  success: boolean
  data?: string
}

type SessionResponse = {
  success: boolean
  data?: {
    sessao_id: string
  }
}

type OmnichannelResponse = {
  success: boolean
  data?: {
    filial?: {
      id?: number
      centro_distribuicao_padrao_id?: number
    }
  }
}

export interface VipCommerceSearchProduct {
  produto_id?: number
  descricao?: string
  link?: string
  imagem?: string
  preco?: number | string
  unidade_sigla?: string
  codigo_barras?: string
  oferta?: {
    preco?: number | string
    preco_oferta?: number | string
    preco_antigo?: number | string
  } | null
}

type VipCommerceSearchResponse = {
  success: boolean
  data?: {
    produtos?: VipCommerceSearchProduct[]
  }
}

export interface VipCommerceSessionContext {
  orgId: number
  domainKey: string
  token: string
  sessionId: string
  storefrontFilialId: number
  distributionCenterId: number
  expiresAt: number
}

export type VipCommerceMarketConfig = {
  marketName: string
  host: string
  authKey: string
  authUsername?: string
  timeoutMs?: number
  sessionTtlMs?: number
  defaultStorefrontFilialId: number
  defaultDistributionCenterId: number
  vipcommerceFilialId?: number
  sendFilialHeader?: boolean
}

const cachedSessions = new Map<string, VipCommerceSessionContext>()
const pendingSessions = new Map<string, Promise<VipCommerceSessionContext>>()

export async function getVipCommerceSession(
  config: VipCommerceMarketConfig
): Promise<VipCommerceSessionContext> {
  const cachedSession = cachedSessions.get(config.host)
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession
  }

  const pendingSession = pendingSessions.get(config.host)
  if (pendingSession) {
    return pendingSession
  }

  const sessionPromise = createVipCommerceSession(config)
  pendingSessions.set(config.host, sessionPromise)

  try {
    const session = await sessionPromise
    cachedSessions.set(config.host, session)
    return session
  } finally {
    pendingSessions.delete(config.host)
  }
}

export async function searchVipCommerceProducts(
  config: VipCommerceMarketConfig,
  session: VipCommerceSessionContext,
  query: string,
  options?: {
    page?: number
    limit?: number
  }
): Promise<VipCommerceSearchProduct[]> {
  const page = options?.page ?? 1
  const limit = options?.limit ?? 40
  const normalizedQuery = query.trim().replace(/[\\/\s%?=]/g, "+")
  const url =
    `${API_BASE_URL}/org/${session.orgId}/filial/${session.storefrontFilialId}` +
    `/centro_distribuicao/${session.distributionCenterId}/loja/buscas/produtos/termo/${normalizedQuery}` +
    `?page=${page}&limit=${limit}&session=${session.sessionId}`

  const response = await requestVipCommerceJson<VipCommerceSearchResponse>(config, "GET", url, {
    headers: buildAuthenticatedHeaders(config, session),
  })

  return response.data?.produtos || []
}

export function mapVipCommerceProduct(
  product: VipCommerceSearchProduct,
  host: string
): MarketProduct | null {
  const name = product.descricao?.trim()
  if (!name) {
    return null
  }

  const basePrice = normalizeVipCommercePrice(product.preco)
  const offerPrice = normalizeVipCommercePrice(
    product.oferta?.preco_oferta ?? product.oferta?.preco
  )
  const finalPrice =
    offerPrice > 0 && (basePrice <= 0 || offerPrice < basePrice)
      ? offerPrice
      : basePrice

  return {
    name: name.substring(0, 200),
    price: finalPrice,
    priceFormatted: finalPrice > 0 ? formatVipCommercePrice(finalPrice) : "Preco indisponivel",
    imageUrl: normalizeVipCommerceImageUrl(product.imagem, host),
    productUrl: buildVipCommerceProductUrl(product, host),
    unit: product.unidade_sigla?.trim() || null,
  }
}

async function createVipCommerceSession(
  config: VipCommerceMarketConfig
): Promise<VipCommerceSessionContext> {
  const organization = await requestVipCommerceJson<OrganizationLookupResponse>(
    config,
    "GET",
    `${ORGANIZATIONS_BASE_URL}/filiais/dominio/${config.host}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (!organization.data?.organizacao?.id || !organization.data.organizacao.enderecoServidor) {
    throw new Error(`Nao foi possivel resolver a organizacao do ${config.marketName}.`)
  }

  const orgId = organization.data.organizacao.id
  const domainKey = organization.data.organizacao.enderecoServidor
  const defaultHeaders = buildApiHeaders(orgId, domainKey)

  const tokenResponse = await requestVipCommerceJson<TokenResponse>(
    config,
    "POST",
    `${API_BASE_URL}/org/${orgId}/auth/loja/login`,
    {
      headers: defaultHeaders,
      body: JSON.stringify({
        domain: domainKey,
        username: config.authUsername || DEFAULT_AUTH_USERNAME,
        key: config.authKey,
      }),
    }
  )

  if (!tokenResponse.data) {
    throw new Error(`Nao foi possivel obter o token inicial do ${config.marketName}.`)
  }

  let storefrontFilialId = config.defaultStorefrontFilialId
  let distributionCenterId = config.defaultDistributionCenterId

  if (config.vipcommerceFilialId) {
    const omnichannel = await requestVipCommerceJson<OmnichannelResponse>(
      config,
      "GET",
      `${API_BASE_URL}/org/${orgId}/loja/omnichannel/${config.vipcommerceFilialId}`,
      {
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${tokenResponse.data}`,
          FilialID: String(config.defaultStorefrontFilialId),
        },
      }
    )

    storefrontFilialId = omnichannel.data?.filial?.id || storefrontFilialId
    distributionCenterId =
      omnichannel.data?.filial?.centro_distribuicao_padrao_id || distributionCenterId
  }

  const sessionResponse = await requestVipCommerceJson<SessionResponse>(
    config,
    "GET",
    `${API_BASE_URL}/org/${orgId}/loja/sessao_cliente`,
    {
      headers: {
        ...defaultHeaders,
        Authorization: `Bearer ${tokenResponse.data}`,
        ...(config.sendFilialHeader ? { FilialID: String(storefrontFilialId) } : {}),
      },
    }
  )

  if (!sessionResponse.data?.sessao_id) {
    throw new Error(`Nao foi possivel iniciar a sessao do ${config.marketName}.`)
  }

  logger.debug(config.marketName, "Sessao inicializada", {
    orgId,
    vipcommerceFilialId: config.vipcommerceFilialId,
    storefrontFilialId,
    distributionCenterId,
  })

  return {
    orgId,
    domainKey,
    token: tokenResponse.data,
    sessionId: sessionResponse.data.sessao_id,
    storefrontFilialId,
    distributionCenterId,
    expiresAt: Date.now() + (config.sessionTtlMs ?? 10 * 60 * 1000),
  }
}

function buildApiHeaders(orgId: number, domainKey: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    DomainKey: domainKey,
    OrganizationId: String(orgId),
  }
}

function buildAuthenticatedHeaders(
  config: VipCommerceMarketConfig,
  session: VipCommerceSessionContext
) {
  return {
    ...buildApiHeaders(session.orgId, session.domainKey),
    ...(config.sendFilialHeader ? { FilialID: String(session.storefrontFilialId) } : {}),
    Authorization: `Bearer ${session.token}`,
    "sessao-id": session.sessionId,
  }
}

async function requestVipCommerceJson<T>(
  config: VipCommerceMarketConfig,
  method: "GET" | "POST",
  url: string,
  options?: {
    headers?: Record<string, string>
    body?: string
  }
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000)

  logger.request(config.marketName, method, url)

  try {
    const response = await fetch(url, {
      method,
      headers: options?.headers,
      body: options?.body,
      signal: controller.signal,
      cache: "no-store",
    })

    logger.response(config.marketName, response.status)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 250)}`)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Tempo limite excedido ao consultar o ${config.marketName}.`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function buildVipCommerceProductUrl(
  product: VipCommerceSearchProduct,
  host: string
): string | null {
  if (typeof product.link === "string" && product.link.trim().length > 0) {
    const slug = product.link.replace(/^\/+/, "").trim()
    if (!slug) {
      return null
    }

    if (product.produto_id) {
      return `https://${host}/produto/${product.produto_id}/${slug}`
    }

    return `https://${host}/produto/${slug}`
  }

  if (!product.produto_id || !product.descricao) {
    return null
  }

  return `https://${host}/produto/${product.produto_id}/${slugify(product.descricao)}`
}

function normalizeVipCommerceImageUrl(value: string | undefined, host: string): string | null {
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
    return `https://${host}${value}`
  }

  return `${PRODUCT_IMAGE_BASE_URL}/${value.replace(/^\/+/, "")}`
}

function normalizeVipCommercePrice(value?: number | string): number {
  if (typeof value === "number") {
    return normalizeVipCommerceNumericPrice(value)
  }

  if (typeof value !== "string") {
    return 0
  }

  const hasDecimalSeparator = /[.,]/.test(value)
  const normalized = value
    .trim()
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  const price = Number(normalized)
  if (!Number.isFinite(price) || price <= 0) {
    return 0
  }

  return hasDecimalSeparator ? price : normalizeVipCommerceNumericPrice(price)
}

function normalizeVipCommerceNumericPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  if (Number.isInteger(value) && value >= 100) {
    return value / 100
  }

  return value
}

function formatVipCommercePrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
