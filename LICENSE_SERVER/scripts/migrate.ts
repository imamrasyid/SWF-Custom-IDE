import { getDb } from '../lib/turso'

async function main() {
  console.log('Running database migration...')
  await getDb()
  console.log('Migration complete!')
}

main().catch(console.error)
