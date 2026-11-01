import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { validateEnv } from '../src/config/env.schema.js';

config();

function resetTestDb(): void {
  const env = validateEnv(process.env);

  if (env.NODE_ENV !== 'test') {
    console.error('❌ Refusing to reset database: NODE_ENV must be set to "test"');
    process.exit(1);
  }

  // Double check that database URL or host contains 'test'
  const isTestDb =
    env.DIRECT_URL.toLowerCase().includes('test') ||
    env.DATABASE_URL.toLowerCase().includes('test');
  if (!isTestDb) {
    console.error('❌ Refusing to reset database: Connection string does not contain "test"');
    process.exit(1);
  }

  console.log('Resetting test database...');
  execSync('prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
  console.log('✅ Test database reset completed.');
}

resetTestDb();
