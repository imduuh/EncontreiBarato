/**
 * =============================================================================
 * UTILITARIO DE LOGGING PARA OS SCRAPERS
 * =============================================================================
 * Fornece funcoes de log formatadas e coloridas usando Chalk.
 * Facilita o debug e monitoramento dos scrapers.
 */

import chalk from "chalk"

/**
 * Cores associadas a cada mercado para facilitar identificacao nos logs.
 */
const MARKET_COLORS: Record<string, (text: string) => string> = {
  barracao: chalk.hex("#16833B"),
  tenda: chalk.red,
  samsclub: chalk.blue,
  tauste: chalk.hex("#ed5e1c"),  // Laranja
  confianca: chalk.green,
  atacadao: chalk.hex("#F7941D"), // Laranja Atacadao
}

/**
 * Retorna a funcao de cor para um mercado especifico.
 * Usa cinza como fallback para mercados nao mapeados.
 */
function getMarketColor(market: string): (text: string) => string {
  return MARKET_COLORS[market.toLowerCase()] || chalk.gray
}

/**
 * Formata o nome do mercado com colchetes e cor.
 */
function formatMarket(market: string): string {
  const colorFn = getMarketColor(market)
  return colorFn(`[${market}]`)
}

/**
 * Logger centralizado para os scrapers.
 * Cada metodo adiciona um prefixo colorido indicando o tipo de mensagem.
 */
export const logger = {
  /**
   * Log de informacao geral.
   * Usado para indicar progresso normal da execucao.
   * 
   * @param market - Nome do mercado (ex: "Tenda", "Atacadao")
   * @param message - Mensagem principal
   * @param data - Dados adicionais opcionais para exibir
   * 
   * @example
   * logger.info("Tenda", "Buscando produtos", { query: "arroz" })
   * // Output: [INFO] [Tenda] Buscando produtos { query: 'arroz' }
   */
  info: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.cyan("[INFO]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  /**
   * Log de sucesso.
   * Usado quando uma operacao foi concluida com exito.
   * 
   * @param market - Nome do mercado
   * @param message - Mensagem de sucesso
   * @param data - Dados adicionais opcionais
   * 
   * @example
   * logger.success("Atacadao", "Encontrados 10 produtos")
   */
  success: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.green("[OK]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  /**
   * Log de aviso.
   * Usado para situacoes que nao sao erros mas merecem atencao.
   * 
   * @param market - Nome do mercado
   * @param message - Mensagem de aviso
   * @param data - Dados adicionais opcionais
   * 
   * @example
   * logger.warn("Tenda", "Preco nao encontrado, usando fallback")
   */
  warn: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.yellow("[WARN]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  /**
   * Log de erro.
   * Usado quando algo deu errado na execucao.
   * 
   * @param market - Nome do mercado
   * @param message - Mensagem de erro
   * @param error - Objeto de erro ou dados adicionais
   * 
   * @example
   * logger.error("Confianca", "Falha na requisicao", error)
   */
  error: (market: string, message: string, error?: unknown) => {
    const prefix = chalk.red("[ERRO]")
    const marketTag = formatMarket(market)
    if (error !== undefined) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(prefix, marketTag, message, chalk.dim(errorMsg))
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  /**
   * Log de debug.
   * Usado para informacoes detalhadas uteis durante desenvolvimento.
   * 
   * @param market - Nome do mercado
   * @param message - Mensagem de debug
   * @param data - Dados para inspecao
   * 
   * @example
   * logger.debug("Tauste", "Resposta da API", { status: 200, items: 5 })
   */
  debug: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.magenta("[DEBUG]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  /**
   * Log de requisicao HTTP.
   * Usado para indicar que uma requisicao esta sendo feita.
   * 
   * @param market - Nome do mercado
   * @param method - Metodo HTTP (GET, POST, etc)
   * @param url - URL da requisicao
   * 
   * @example
   * logger.request("SamsClub", "GET", "https://api.samsclub.com.br/search")
   */
  request: (market: string, method: string, url: string) => {
    const prefix = chalk.blue("[HTTP]")
    const marketTag = formatMarket(market)
    const methodTag = chalk.bold(method)
    // Mostra apenas o path da URL para nao poluir o log
    const urlPath = url.replace(/https?:\/\/[^/]+/, "")
    console.log(prefix, marketTag, methodTag, chalk.dim(urlPath))
  },

  /**
   * Log de resposta HTTP.
   * Usado para indicar o resultado de uma requisicao.
   * 
   * @param market - Nome do mercado
   * @param status - Codigo de status HTTP
   * @param message - Mensagem opcional
   * 
   * @example
   * logger.response("Atacadao", 200, "OK")
   */
  response: (market: string, status: number, message?: string) => {
    const prefix = chalk.blue("[HTTP]")
    const marketTag = formatMarket(market)
    const statusColor = status >= 200 && status < 300 ? chalk.green : chalk.red
    const statusTag = statusColor(`${status}`)
    if (message) {
      console.log(prefix, marketTag, "Status:", statusTag, chalk.dim(message))
    } else {
      console.log(prefix, marketTag, "Status:", statusTag)
    }
  },
}

export default logger
