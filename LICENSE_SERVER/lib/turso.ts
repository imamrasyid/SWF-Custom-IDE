import { createClient } from '@libsql/client'

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'file:local.db'
const TURSO_AUTH = process.env.TURSO_AUTH_TOKEN || ''

let client: ReturnType<typeof createClient> | null = null
let migrated = false

export async function getDb() {
  if (!client) {
    client = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH || undefined,
    })
  }
  if (!migrated) {
    migrated = true
    await migrate(client)
  }
  return client
}

async function migrate(db: ReturnType<typeof createClient>) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      license_key_hash TEXT UNIQUE NOT NULL,
      product TEXT NOT NULL DEFAULT 'ninjasage-modding-toolkit',
      type TEXT NOT NULL DEFAULT 'lifetime',
      max_activations INTEGER NOT NULL DEFAULT 3,
      features TEXT NOT NULL DEFAULT '[]',
      issued_at INTEGER NOT NULL,
      customer_email TEXT,
      order_id TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      machine_fingerprint TEXT NOT NULL,
      activated_at INTEGER NOT NULL,
      last_verified INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      deactivated_at INTEGER,
      ip_address TEXT,
      app_version TEXT,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetry_events (
      id TEXT PRIMARY KEY,
      license_id TEXT,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      app_version TEXT,
      os TEXT,
      payload TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telemetry_sessions (
      id TEXT PRIMARY KEY,
      license_id TEXT,
      device_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      app_version TEXT,
      os TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key_hash);
    CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product);
    CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
    CREATE INDEX IF NOT EXISTS idx_activations_device ON activations(device_id);
    CREATE INDEX IF NOT EXISTS idx_activations_active ON activations(is_active);
    CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_telemetry_events_created ON telemetry_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_device ON telemetry_sessions(device_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_started ON telemetry_sessions(started_at);
  `)
}

export function hashLicenseKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h' + Math.abs(hash).toString(36)
}
