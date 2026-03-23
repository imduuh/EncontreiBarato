import type { SearchRegion } from "@/lib/regions"

/**
 * =============================================================================
 * TIPOS E INTERFACES PARA O COMPARADOR DE PRECOS
 * =============================================================================
 * Define as estruturas de dados usadas em todo o sistema de scraping.
 */

/**
 * Representa um preco promocional por quantidade.
 * Usado quando o mercado oferece desconto para compras em maior quantidade.
 * 
 * Exemplo: "Leve 3 por R$ 10,00 cada" seria:
 * { price: 10.00, minQuantity: 3, priceFormatted: "R$ 10,00" }
 */
export interface BulkPrice {
  price: number              // Preco unitario com desconto
  minQuantity: number        // Quantidade minima para obter o desconto
  priceFormatted: string     // Preco formatado para exibicao
  description?: string       // Descricao da promocao (ex: "Leve 3 pague 2")
}

/**
 * Representa um produto encontrado em um mercado.
 * Contem todas as informacoes necessarias para exibir e comparar o produto.
 */
export interface MarketProduct {
  name: string               // Nome do produto
  price: number              // Preco unitario normal (sem desconto por quantidade)
  priceFormatted: string     // Preco formatado para exibicao (ex: "R$ 10,99")
  imageUrl: string | null    // URL da imagem do produto (pode ser null se nao disponivel)
  productUrl: string | null  // URL para a pagina do produto no site do mercado
  unit: string | null        // Unidade de medida (ex: "kg", "un", "L")
  bulkPrice?: BulkPrice      // Preco promocional por quantidade (opcional)
}

/**
 * Resultado da busca em um mercado especifico.
 * Contem os produtos encontrados ou informacoes de erro.
 */
export interface MarketResult {
  market: MarketInfo         // Informacoes do mercado
  products: MarketProduct[]  // Lista de produtos encontrados
  status: "success" | "error" | "loading"  // Status da busca
  error?: string             // Mensagem de erro (se status === "error")
  searchedAt: string         // Timestamp ISO da busca
}

/**
 * Informacoes de um mercado.
 * Define a identidade visual e URLs do mercado.
 */
export interface MarketInfo {
  id: string                 // Identificador unico (ex: "tenda", "atacadao")
  name: string               // Nome para exibicao (ex: "Tenda Atacado")
  color: string              // Cor do mercado em hex (para UI)
  url: string                // URL base do site do mercado
  logo: string               // Caminho para o logo do mercado
}

/**
 * Lista de mercados suportados pelo sistema.
 * Cada mercado tem seu proprio scraper em lib/scrapers/[id].ts
 */
export const MARKETS: MarketInfo[] = [
  {
    id: "barracao",
    name: "Barracao",
    color: "#16833B",
    url: "https://www.barracaosm.com.br",
    logo: "/markets/barracao.svg",
  },
  {
    id: "tenda",
    name: "Tenda Atacado",
    color: "#E31E24",        // Vermelho Tenda
    url: "https://www.tendaatacado.com.br",
    logo: "/markets/tenda.svg",
  },
  {
    id: "samsclub",
    name: "Sam's Club",
    color: "#0060A9",        // Azul Sam's
    url: "https://www.samsclub.com.br",
    logo: "/markets/samsclub.svg",
  },
  {
    id: "tauste",
    name: "Tauste",
    color: "#ed5e1c",        // Laranja Tauste
    url: "https://tauste.com.br",
    logo: "/markets/tauste.svg",
  },
  {
    id: "confianca",
    name: "Confianca",
    color: "#00A651",        // Verde Confianca
    url: "https://www.confianca.com.br",
    logo: "/markets/confianca.svg",
  },
  {
    id: "atacadao",
    name: "Atacadao",
    color: "#F7941D",        // Laranja Atacadao (cor oficial)
    url: "https://www.atacadao.com.br",
    logo: "/markets/atacadao.svg",
  },
]

/**
 * Resposta completa de uma busca.
 * Contem os resultados de todos os mercados.
 */
export interface SearchResponse {
  query: string              // Termo buscado pelo usuario
  results: MarketResult[]    // Resultados de cada mercado
  region: SearchRegion       // Contexto regional da busca
  timestamp: string          // Timestamp ISO da busca
}

export interface ScraperContext {
  region: SearchRegion
}
