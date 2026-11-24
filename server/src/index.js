import { config } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';
import { scheduleNoShowJob } from './jobs/noShows.js';

const app = createApp();

await prisma.$connect();
scheduleNoShowJob();

const server = app.listen(config.port, () => {
  console.log(`Health Synapsis API listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
