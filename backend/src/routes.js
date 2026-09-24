const config = require('./config');
const { project, messages } = require('./constants');
const { sendJson } = require('./response');
const logger = require('./logger');
const careStore = require('./careStore');

const MAX_BODY_BYTES = 1024 * 1024;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new careStore.ApiError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const readJson = async (req) => {
  const raw = await readBody(req);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new careStore.ApiError(400, messages.badJson);
  }
};

const TASK_COMPLETE_PATTERN = /^\/api\/care\/tasks\/(\d+)\/complete$/;

const createHandler = ({ pool }) => async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method || 'GET';

  try {
    if (path === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        service: project.id,
        message: messages.health,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (path === '/api/info' && method === 'GET') {
      sendJson(res, 200, {
        ...project,
        database: config.database,
      });
      return;
    }

    if (path === '/api/care/board' && method === 'GET') {
      sendJson(res, 200, await careStore.getBoard(pool));
      return;
    }

    if (path === '/api/care/person' && method === 'POST') {
      const body = await readJson(req);
      const person = await careStore.setInitialPerson(pool, body.name);
      sendJson(res, 201, { currentPerson: person });
      return;
    }

    if (path === '/api/care/tasks' && method === 'POST') {
      const body = await readJson(req);
      const task = await careStore.addTask(pool, body.title);
      sendJson(res, 201, { task });
      return;
    }

    const completeMatch = path.match(TASK_COMPLETE_PATTERN);
    if (completeMatch && method === 'POST') {
      await careStore.completeTask(pool, completeMatch[1]);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === '/api/care/handover' && method === 'POST') {
      const body = await readJson(req);
      const record = await careStore.handover(pool, body.toPerson);
      sendJson(res, 201, { handover: record });
      return;
    }

    sendJson(res, 404, { error: messages.notFound, path });
  } catch (err) {
    if (err instanceof careStore.ApiError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    logger.error(`unhandled error: ${err.message}`, { stack: err.stack });
    sendJson(res, 500, { error: messages.internalError });
  }
};

module.exports = {
  createHandler,
};
