const http = require('node:http');
const config = require('./config');
const { messages } = require('./constants');
const { createHandler } = require('./routes');
const { createPool, ensureSchema } = require('./db');
const logger = require('./logger');

const start = async () => {
  const pool = createPool();
  pool.on('error', (err) => {
    logger.error(`database pool error: ${err.message}`);
  });

  await ensureSchema(pool);

  const server = http.createServer(createHandler({ pool }));
  server.listen(config.port, config.host, () => {
    logger.info(`${messages.serverStarted} on ${config.port}`);
  });
};

start().catch((err) => {
  logger.error(`failed to start server: ${err.message}`);
  process.exit(1);
});
