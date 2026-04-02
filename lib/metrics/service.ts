import type { SearchRegion } from "@/lib/regions"
import type { MarketResult } from "@/lib/scrapers/types"
import { getMetricsDatabase } from "./db"

export type ScraperMetricInput = {
  marketId: string
  marketName: string
  status: "success" | "error"
  latencyMs: number
  productCount: number
  timeout: boolean
  errorMessage?: string
}

export type SearchMetricInput = {
  query: string
  city: string
  state: string
  region: SearchRegion
  latencyMs: number
  status: "success" | "error" | "bad_request"
  totalProducts: number
  enabledMarketsCount: number
  successfulMarketsCount: number
  errorMarketsCount: number
  cacheHit: boolean
  cacheMiss: boolean
  inFlightReused: boolean
  scraperRuns?: ScraperMetricInput[]
}

type Percentiles = {
  p50: number
  p90: number
  p95: number
  p99: number
}

function toPercentiles(values: number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b)
  const getPercentile = (percentile: number) => {
    if (sorted.length === 0) return 0
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
    )
    return sorted[index]
  }

  return {
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0
  return (part / total) * 100
}

function startOfWindow(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export function recordSearchMetric(input: SearchMetricInput) {
  const db = getMetricsDatabase()
  const insertRequest = db.prepare(`
    INSERT INTO search_request_metrics (
      created_at,
      query,
      city,
      state,
      region_label,
      is_supported_region,
      latency_ms,
      status,
      total_products,
      enabled_markets_count,
      successful_markets_count,
      error_markets_count,
      cache_hit,
      cache_miss,
      in_flight_reused
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const createdAt = new Date().toISOString()
  const result = insertRequest.run(
    createdAt,
    input.query,
    input.city,
    input.state,
    input.region.label,
    input.region.isSupported ? 1 : 0,
    Math.max(0, Math.round(input.latencyMs)),
    input.status,
    input.totalProducts,
    input.enabledMarketsCount,
    input.successfulMarketsCount,
    input.errorMarketsCount,
    input.cacheHit ? 1 : 0,
    input.cacheMiss ? 1 : 0,
    input.inFlightReused ? 1 : 0
  )

  if (!input.scraperRuns?.length) {
    return
  }

  const insertScraperRun = db.prepare(`
    INSERT INTO scraper_run_metrics (
      request_metric_id,
      created_at,
      market_id,
      market_name,
      status,
      latency_ms,
      product_count,
      timeout,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const scraperRun of input.scraperRuns) {
    insertScraperRun.run(
      result.lastInsertRowid,
      createdAt,
      scraperRun.marketId,
      scraperRun.marketName,
      scraperRun.status,
      Math.max(0, Math.round(scraperRun.latencyMs)),
      scraperRun.productCount,
      scraperRun.timeout ? 1 : 0,
      scraperRun.errorMessage || null
    )
  }
}

export function getMetricsDashboard() {
  const db = getMetricsDatabase()
  const requestRows = db.prepare(`
    SELECT *
    FROM search_request_metrics
    ORDER BY created_at DESC
    LIMIT 2000
  `).all() as Array<Record<string, unknown>>

  const scraperRows = db.prepare(`
    SELECT *
    FROM scraper_run_metrics
    ORDER BY created_at DESC
    LIMIT 5000
  `).all() as Array<Record<string, unknown>>

  const latencyValues = requestRows.map((row) => Number(row.latency_ms) || 0)
  const searchPercentiles = toPercentiles(latencyValues)
  const totalRequests = requestRows.length
  const totalCacheHits = requestRows.filter((row) => Number(row.cache_hit) === 1).length
  const totalCacheMisses = requestRows.filter((row) => Number(row.cache_miss) === 1).length
  const totalInFlightReused = requestRows.filter((row) => Number(row.in_flight_reused) === 1).length
  const successfulRequests = requestRows.filter((row) => row.status === "success").length
  const unsupportedRegionRequests = requestRows.filter((row) => Number(row.is_supported_region) === 0).length

  const requestsLast5Minutes = requestRows.filter(
    (row) => String(row.created_at) >= startOfWindow(5)
  ).length
  const requestsLast60Minutes = requestRows.filter(
    (row) => String(row.created_at) >= startOfWindow(60)
  ).length

  const scraperByMarket = new Map<
    string,
    {
      marketId: string
      marketName: string
      latencies: number[]
      totalRuns: number
      successRuns: number
      errorRuns: number
      timeoutRuns: number
      productCounts: number[]
    }
  >()

  for (const row of scraperRows) {
    const marketId = String(row.market_id)
    const marketName = String(row.market_name)
    const bucket = scraperByMarket.get(marketId) || {
      marketId,
      marketName,
      latencies: [],
      totalRuns: 0,
      successRuns: 0,
      errorRuns: 0,
      timeoutRuns: 0,
      productCounts: [],
    }

    bucket.totalRuns += 1
    bucket.latencies.push(Number(row.latency_ms) || 0)
    bucket.productCounts.push(Number(row.product_count) || 0)

    if (row.status === "success") bucket.successRuns += 1
    if (row.status === "error") bucket.errorRuns += 1
    if (Number(row.timeout) === 1) bucket.timeoutRuns += 1

    scraperByMarket.set(marketId, bucket)
  }

  const scraperStats = [...scraperByMarket.values()]
    .map((entry) => ({
      marketId: entry.marketId,
      marketName: entry.marketName,
      totalRuns: entry.totalRuns,
      successRate: percentage(entry.successRuns, entry.totalRuns),
      errorRate: percentage(entry.errorRuns, entry.totalRuns),
      timeoutRate: percentage(entry.timeoutRuns, entry.totalRuns),
      averageLatencyMs: average(entry.latencies),
      averageProducts: average(entry.productCounts),
      ...toPercentiles(entry.latencies),
    }))
    .sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)

  const latestRequests = requestRows.slice(0, 20).map((row) => ({
    createdAt: String(row.created_at),
    query: String(row.query),
    regionLabel: String(row.region_label),
    latencyMs: Number(row.latency_ms) || 0,
    status: String(row.status),
    totalProducts: Number(row.total_products) || 0,
    cacheHit: Number(row.cache_hit) === 1,
    inFlightReused: Number(row.in_flight_reused) === 1,
  }))

  return {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    summary: {
      totalRequests,
      successfulRequests,
      requestSuccessRate: percentage(successfulRequests, totalRequests),
      unsupportedRegionRequests,
      totalCacheHits,
      totalCacheMisses,
      totalInFlightReused,
      cacheHitRate: percentage(totalCacheHits, totalCacheHits + totalCacheMisses),
      cacheMissRate: percentage(totalCacheMisses, totalCacheHits + totalCacheMisses),
      averageLatencyMs: average(latencyValues),
      minLatencyMs: latencyValues.length ? Math.min(...latencyValues) : 0,
      maxLatencyMs: latencyValues.length ? Math.max(...latencyValues) : 0,
      rpsLast5Minutes: requestsLast5Minutes / (5 * 60),
      rpsLast60Minutes: requestsLast60Minutes / (60 * 60),
      ...searchPercentiles,
    },
    scraperStats,
    latestRequests,
  }
}

export function summarizeSearchResults(results: MarketResult[]) {
  return {
    totalProducts: results.reduce(
      (sum, item) => sum + (item.status === "success" ? item.products.length : 0),
      0
    ),
    successfulMarketsCount: results.filter((item) => item.status === "success").length,
    errorMarketsCount: results.filter((item) => item.status === "error").length,
  }
}
