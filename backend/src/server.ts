import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
process.loadEnvFile(resolve(__dirname, '../.env'));

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.routes.js';
import { rendaFixaRoutes } from './routes/renda-fixa.routes.js';
import { fiiRoutes } from './routes/fii.routes.js';
import { aporteRoutes } from './routes/aporte.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { CronService } from './services/cron.service.js';
import { MarketDataService } from './services/market-data.service.js';
import { FIIRepository } from './repositories/fii.repository.js';
import { CronLogRepository } from './repositories/cron-log.repository.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: 'http://localhost:3000',
});

fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(rendaFixaRoutes, { prefix: '/api/renda-fixa' });
await fastify.register(fiiRoutes, { prefix: '/api/fiis' });
await fastify.register(aporteRoutes, { prefix: '/api/aportes' });
await fastify.register(exportRoutes, { prefix: '/api/export' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Backend server running on http://localhost:4000');

    // Initialize and start the Cron Service for quote/dividend updates
    const marketDataService = new MarketDataService();
    const fiiRepository = new FIIRepository();
    const cronLogRepository = new CronLogRepository();
    const cronService = new CronService({
      marketDataService,
      fiiRepository,
      cronLogRepository,
    });

    // Schedule automatic updates 2x/day (8am and 4pm)
    cronService.scheduleQuoteUpdate();
    console.log('Cron service started: quote updates scheduled for 8:00 and 16:00');

    // Run initial update on startup (if more than 8h since last run)
    cronService.executeQuoteUpdate().then((result) => {
      console.log(`Initial quote update: ${result.successCount} success, ${result.failureCount} failures`);
    }).catch((err) => {
      console.error('Initial quote update failed:', err);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
