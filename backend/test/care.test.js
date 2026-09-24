const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');

const { createHandler } = require('../src/routes');
const { ensureSchema } = require('../src/db');

const createMemPool = async (mem) => {
  // noAstCoverageCheck：pg-mem 对重复执行的 CREATE TABLE IF NOT EXISTS 会误报 AST 覆盖问题
  const db = mem || newDb({ noAstCoverageCheck: true });
  const pg = db.adapters.createPg();
  const pool = new pg.Pool();
  await ensureSchema(pool);
  return pool;
};

const startServer = (pool) =>
  new Promise((resolve) => {
    const server = http.createServer(createHandler({ pool }));
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });

const withServer = async (pool, fn) => {
  const { server, baseUrl } = await startServer(pool);
  try {
    const api = async (path, options = {}) => {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const body = await res.json();
      return { status: res.status, body };
    };
    await fn(api);
  } finally {
    server.close();
  }
};

const post = (api, path, payload) =>
  api(path, { method: 'POST', body: JSON.stringify(payload) });

const getBoard = async (api) => {
  const { status, body } = await api('/api/care/board');
  assert.equal(status, 200);
  return body;
};

test('health endpoint still works', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    const { status, body } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  });
});

test('board starts empty and rejects actions before a person is set', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    const board = await getBoard(api);
    assert.equal(board.currentPerson, null);
    assert.equal(board.pendingCount, 0);
    assert.equal(board.lastHandoverAt, null);
    assert.deepEqual(board.pendingTasks, []);
    assert.deepEqual(board.completedTasks, []);
    assert.deepEqual(board.handovers, []);

    const addRes = await post(api, '/api/care/tasks', { title: '翻身拍背' });
    assert.equal(addRes.status, 409);

    const handoverRes = await post(api, '/api/care/handover', { toPerson: '女儿' });
    assert.equal(handoverRes.status, 409);
  });
});

test('initial person can only be set once', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    const first = await post(api, '/api/care/person', { name: ' 妈妈 ' });
    assert.equal(first.status, 201);
    assert.equal(first.body.currentPerson, '妈妈');

    const again = await post(api, '/api/care/person', { name: '爸爸' });
    assert.equal(again.status, 409);

    const empty = await post(api, '/api/care/person', { name: '   ' });
    assert.equal(empty.status, 400);

    const board = await getBoard(api);
    assert.equal(board.currentPerson, '妈妈');
  });
});

test('tasks are added under the current person and completed into the archive', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    await post(api, '/api/care/person', { name: '妈妈' });

    const badTask = await post(api, '/api/care/tasks', { title: '  ' });
    assert.equal(badTask.status, 400);

    const t1 = await post(api, '/api/care/tasks', { title: '8点喂药' });
    const t2 = await post(api, '/api/care/tasks', { title: '翻身拍背' });
    assert.equal(t1.status, 201);
    assert.equal(t2.status, 201);
    assert.equal(t1.body.task.assignee, '妈妈');

    let board = await getBoard(api);
    assert.equal(board.pendingCount, 2);

    const done = await post(api, `/api/care/tasks/${t1.body.task.id}/complete`, {});
    assert.equal(done.status, 200);

    board = await getBoard(api);
    assert.equal(board.pendingCount, 1);
    assert.equal(board.completedTasks.length, 1);
    assert.equal(board.completedTasks[0].title, '8点喂药');
    assert.equal(board.completedTasks[0].completedBy, '妈妈');
    assert.ok(board.completedTasks[0].completedAt);

    const again = await post(api, `/api/care/tasks/${t1.body.task.id}/complete`, {});
    assert.equal(again.status, 409);

    const missing = await post(api, '/api/care/tasks/9999/complete', {});
    assert.equal(missing.status, 404);
  });
});

test('handover is rejected when receiver is the current person or nothing is pending', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    await post(api, '/api/care/person', { name: '妈妈' });
    const task = await post(api, '/api/care/tasks', { title: '记录体温' });

    const same = await post(api, '/api/care/handover', { toPerson: '妈妈' });
    assert.equal(same.status, 409);

    const empty = await post(api, '/api/care/handover', { toPerson: '' });
    assert.equal(empty.status, 400);

    // 完成唯一待办后，没有待办也不能交接
    await post(api, `/api/care/tasks/${task.body.task.id}/complete`, {});
    const noPending = await post(api, '/api/care/handover', { toPerson: '爸爸' });
    assert.equal(noPending.status, 409);

    // 失败交接不改变任何状态
    const board = await getBoard(api);
    assert.equal(board.currentPerson, '妈妈');
    assert.equal(board.pendingCount, 0);
    assert.equal(board.handovers.length, 0);
    assert.equal(board.lastHandoverAt, null);
    assert.equal(board.completedTasks.length, 1);
  });
});

test('successful handover transfers pending tasks and archives everything', async () => {
  const pool = await createMemPool();
  await withServer(pool, async (api) => {
    await post(api, '/api/care/person', { name: '妈妈' });
    await post(api, '/api/care/tasks', { title: '8点喂药' });
    await post(api, '/api/care/tasks', { title: '翻身拍背' });
    const done = await post(api, '/api/care/tasks', { title: '已喂早餐' });
    await post(api, `/api/care/tasks/${done.body.task.id}/complete`, {});

    const res = await post(api, '/api/care/handover', { toPerson: '爸爸' });
    assert.equal(res.status, 201);
    assert.equal(res.body.handover.fromPerson, '妈妈');
    assert.equal(res.body.handover.toPerson, '爸爸');
    assert.equal(res.body.handover.transferredCount, 2);

    const board = await getBoard(api);
    assert.equal(board.currentPerson, '爸爸');
    assert.equal(board.pendingCount, 2);
    assert.ok(board.pendingTasks.every((t) => t.assignee === '爸爸'));
    assert.equal(board.completedTasks.length, 1);
    assert.equal(board.completedTasks[0].completedBy, '妈妈');
    assert.equal(board.handovers.length, 1);
    assert.equal(board.handovers[0].fromPerson, '妈妈');
    assert.equal(board.handovers[0].toPerson, '爸爸');
    assert.ok(board.lastHandoverAt);

    // 新负责人继续完成名下事项
    const pendingId = board.pendingTasks[0].id;
    await post(api, `/api/care/tasks/${pendingId}/complete`, {});
    const after = await getBoard(api);
    assert.equal(after.completedTasks[0].completedBy, '爸爸');
  });
});

test('board data survives a service restart (new pool, same database)', async () => {
  const mem = newDb({ noAstCoverageCheck: true });
  const pool1 = await createMemPool(mem);
  await withServer(pool1, async (api) => {
    await post(api, '/api/care/person', { name: '妈妈' });
    await post(api, '/api/care/tasks', { title: '8点喂药' });
    await post(api, '/api/care/handover', { toPerson: '爸爸' });
  });

  // 模拟服务重启：用同一个数据库新建连接池和服务
  const pool2 = await createMemPool(mem);
  await withServer(pool2, async (api) => {
    const board = await getBoard(api);
    assert.equal(board.currentPerson, '爸爸');
    assert.equal(board.pendingCount, 1);
    assert.equal(board.handovers.length, 1);
    assert.ok(board.lastHandoverAt);
  });
});
