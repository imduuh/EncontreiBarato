import chalk from "chalk"

const MARKET_COLORS: Record<string, (text: string) => string> = {
  sanmichel: chalk.hex("#0F8D35"),
  barracao: chalk.hex("#16833B"),
  oba: chalk.hex("#42873E"),
  tenda: chalk.red,
  samsclub: chalk.blue,
  tauste: chalk.hex("#ed5e1c"),
  confianca: chalk.green,
  atacadao: chalk.hex("#F7941D"),
}

function getMarketColor(market: string): (text: string) => string {
  return MARKET_COLORS[market.toLowerCase()] || chalk.gray
}

function formatMarket(market: string): string {
  const colorFn = getMarketColor(market)
  return colorFn(`[${market}]`)
}

export const logger = {
  info: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.cyan("[INFO]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  success: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.green("[OK]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  warn: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.yellow("[WARN]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

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

  debug: (market: string, message: string, data?: unknown) => {
    const prefix = chalk.magenta("[DEBUG]")
    const marketTag = formatMarket(market)
    if (data !== undefined) {
      console.log(prefix, marketTag, message, data)
    } else {
      console.log(prefix, marketTag, message)
    }
  },

  request: (market: string, method: string, url: string) => {
    const prefix = chalk.blue("[HTTP]")
    const marketTag = formatMarket(market)
    const methodTag = chalk.bold(method)
    const urlPath = url.replace(/https?:\/\/[^/]+/, "")
    console.log(prefix, marketTag, methodTag, chalk.dim(urlPath))
  },

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
