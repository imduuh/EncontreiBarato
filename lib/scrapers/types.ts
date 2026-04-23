import type { SearchRegion } from "@/lib/regions"

export interface BulkPrice {
  price: number
  minQuantity: number
  priceFormatted: string
  description?: string
}

export interface MarketProduct {
  name: string
  price: number
  priceFormatted: string
  imageUrl: string | null
  productUrl: string | null
  unit: string | null
  bulkPrice?: BulkPrice
}

export interface MarketResult {
  market: MarketInfo
  products: MarketProduct[]
  status: "success" | "error" | "loading"
  error?: string
  searchedAt: string
}

export interface MarketInfo {
  id: string
  name: string
  color: string
  url: string
  logo: string
}

export const MARKETS: MarketInfo[] = [
  {
    id: "sanmichel",
    name: "San Michel",
    color: "#0F8D35",
    url: "https://www.supersanmichel.com.br",
    logo: "/markets/sanmichel.svg",
  },
  {
    id: "barracao",
    name: "Barracao",
    color: "#16833B",
    url: "https://www.barracaosm.com.br",
    logo: "/markets/barracao.svg",
  },
  {
    id: "oba",
    name: "Oba Hortifruti",
    color: "#42873E",
    url: "https://www.obahortifruti.com.br",
    logo: "/markets/oba.svg",
  },
  {
    id: "tenda",
    name: "Tenda Atacado",
    color: "#E31E24",
    url: "https://www.tendaatacado.com.br",
    logo: "/markets/tenda.svg",
  },
  {
    id: "samsclub",
    name: "Sam's Club",
    color: "#0060A9",
    url: "https://www.samsclub.com.br",
    logo: "/markets/samsclub.svg",
  },
  {
    id: "tauste",
    name: "Tauste",
    color: "#ed5e1c",
    url: "https://tauste.com.br",
    logo: "/markets/tauste.svg",
  },
  {
    id: "confianca",
    name: "Confianca",
    color: "#00A651",
    url: "https://www.confianca.com.br",
    logo: "/markets/confianca.svg",
  },
  {
    id: "atacadao",
    name: "Atacadao",
    color: "#F7941D",
    url: "https://www.atacadao.com.br",
    logo: "/markets/atacadao.svg",
  },
]

export interface SearchResponse {
  query: string
  results: MarketResult[]
  region: SearchRegion
  timestamp: string
}

export interface ScraperContext {
  region: SearchRegion
}
