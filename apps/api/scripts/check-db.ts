import { config } from 'dotenv';
import pg from 'pg';
import { validateEnv } from '../src/config/env.schema.js';

// Load environment variables from apps/api/.env or system environment
config();

async function main() {
  console.log('Validating environment configuration...');

  let envConfig;
  try {
    envConfig = validateEnv(process.env);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unknown configuration error:', error);
    }
    process.exit(1);
  }

  console.log('Environment configuration valid.');
  console.log('Testing direct database connection to DIRECT_URL...');

  const client = new pg.Client({
    connectionString: envConfig.DIRECT_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version(), current_database() AS current_db');
    const row = result.rows[0];

    console.log('✅ Successfully connected to PostgreSQL database!');
    console.log(`Database: ${row?.current_db ?? 'unknown'}`);
    console.log(`PostgreSQL version: ${row?.version ?? 'unknown'}`);
  } catch (err) {
    console.error('❌ Failed to connect to database:');
    if (err instanceof Error) {
      console.error(`  ${err.message}`);
    } else {
      console.error('  Unknown database error');
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
