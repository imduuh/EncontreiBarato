import { mkdirSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const DEFAULT_DB_PATH = join(process.cwd(), "data", "metrics.sqlite")

declare global {
  var __metricsDb: DatabaseSync | undefined
}

function getDatabasePath() {
  return process.env.METRICS_SQLITE_PATH || DEFAULT_DB_PATH
}

export function getMetricsDatabase() {
  if (globalThis.__metricsDb) {
    return globalThis.__metricsDb
  }

  const dbPath = getDatabasePath()
  const dbDir = dirname(dbPath)

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS search_request_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      query TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      region_label TEXT NOT NULL,
      is_supported_region INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      total_products INTEGER NOT NULL DEFAULT 0,
      enabled_markets_count INTEGER NOT NULL DEFAULT 0,
      successful_markets_count INTEGER NOT NULL DEFAULT 0,
      error_markets_count INTEGER NOT NULL DEFAULT 0,
      cache_hit INTEGER NOT NULL DEFAULT 0,
      cache_miss INTEGER NOT NULL DEFAULT 0,
      in_flight_reused INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scraper_run_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_metric_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      market_id TEXT NOT NULL,
      market_name TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      timeout INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (request_metric_id) REFERENCES search_request_metrics(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_search_request_metrics_created_at
      ON search_request_metrics(created_at);

    CREATE INDEX IF NOT EXISTS idx_scraper_run_metrics_request_metric_id
      ON scraper_run_metrics(request_metric_id);

    CREATE INDEX IF NOT EXISTS idx_scraper_run_metrics_market_id_created_at
      ON scraper_run_metrics(market_id, created_at);
  `)

  globalThis.__metricsDb = db
  return db
}
