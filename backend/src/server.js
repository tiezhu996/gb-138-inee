const http = require('node:http');
const config = require('./config');
const { messages } = require('./constants');
const { handleRequest } = require('./routes');
const store = require('./store');
const logger = require('./logger');

const server = http.createServer(handleRequest);

store
  .init()
  .then(() => {
    server.listen(config.port, config.host, () => {
      logger.info(`${messages.serverStarted} on ${config.port}`);
    });
  })
  .catch((error) => {
    logger.error('服务启动失败', error);
    process.exit(1);
  });
