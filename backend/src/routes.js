const config = require('./config');
const { project, messages } = require('./constants');
const { sendJson } = require('./response');
const handover = require('./handover');

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('请求体不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });

const dispatchHandover = async (req, res, method, pathname) => {
  if (method === 'GET' && pathname === '/api/handover') {
    sendJson(res, 200, { data: handover.getBoard() });
    return;
  }
  if (method === 'POST' && pathname === '/api/handover/start') {
    const body = await readJsonBody(req);
    const board = await handover.startBoard(body);
    sendJson(res, 200, { data: board });
    return;
  }
  if (method === 'POST' && pathname === '/api/handover/todos') {
    const body = await readJsonBody(req);
    const board = await handover.addTodo(body);
    sendJson(res, 200, { data: board });
    return;
  }
  const completeMatch = method === 'POST' && pathname.match(/^\/api\/handover\/todos\/([^/]+)\/complete$/);
  if (completeMatch) {
    const board = await handover.completeTodo(decodeURIComponent(completeMatch[1]));
    sendJson(res, 200, { data: board });
    return;
  }
  if (method === 'POST' && pathname === '/api/handover/handover') {
    const body = await readJsonBody(req);
    const board = await handover.handover(body);
    sendJson(res, 200, { data: board });
    return;
  }
  sendJson(res, 404, { error: messages.notFound, path: pathname });
};

const handleRequest = (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: project.id,
      message: messages.health,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (url.pathname === '/api/info') {
    sendJson(res, 200, {
      ...project,
      database: config.database,
    });
    return;
  }

  if (url.pathname.startsWith('/api/handover')) {
    dispatchHandover(req, res, req.method, url.pathname)
      .catch((error) => {
        const status = error.name === 'HandoverError' ? error.status : 500;
        if (status >= 500) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
        if (!res.headersSent) {
          sendJson(res, status, { error: error.message || '服务器内部错误' });
        }
      });
    return;
  }

  sendJson(res, 404, { error: messages.notFound, path: url.pathname });
};

module.exports = {
  handleRequest,
};
