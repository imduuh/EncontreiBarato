import logger from "./logger"
import type { MarketProduct, ScraperContext } from "./types"
import {
  getVipCommerceSession,
  mapVipCommerceProduct,
  searchVipCommerceProducts,
  type VipCommerceMarketConfig,
} from "./vipcommerce"

const MARKET_NAME = "SanMichel"
const HOST = "supersanmichel.com.br"
const AUTH_KEY = "df072f85df9bf7dd71b6811c34bdbaa4f219d98775b56cff9dfa5f8ca1bf8469"
const MAX_PRODUCTS = 10

const MARKET_CONFIG: VipCommerceMarketConfig = {
  marketName: MARKET_NAME,
  host: HOST,
  authKey: AUTH_KEY,
  defaultStorefrontFilialId: 1,
  defaultDistributionCenterId: 1,
  vipcommerceFilialId: 316,
  sendFilialHeader: true,
}

export async function scrapeSanMichel(
  query: string,
  context?: ScraperContext
): Promise<MarketProduct[]> {
  logger.info(MARKET_NAME, "Iniciando busca", {
    query,
    region: context?.region.label,
    referenceCep: context?.region.referenceCep,
  })

  const session = await getVipCommerceSession(MARKET_CONFIG)
  const products = (await searchVipCommerceProducts(MARKET_CONFIG, session, query))
    .map((product) => mapVipCommerceProduct(product, HOST))
    .filter((product): product is MarketProduct => product !== null)

  if (products.length === 0) {
    logger.warn(MARKET_NAME, "Nenhum produto retornado pela busca principal", {
      query,
      region: context?.region.label,
      storefrontFilialId: session.storefrontFilialId,
      distributionCenterId: session.distributionCenterId,
    })
    return []
  }

  logger.success(MARKET_NAME, `Encontrados ${products.length} produtos`, {
    region: context?.region.label,
    storefrontFilialId: session.storefrontFilialId,
    distributionCenterId: session.distributionCenterId,
  })

  return products.slice(0, MAX_PRODUCTS)
}
