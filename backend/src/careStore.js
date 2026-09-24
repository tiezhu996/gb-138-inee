class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_NAME_LENGTH = 50;
const MAX_TITLE_LENGTH = 200;

const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');

const requireName = (value, label) => {
  const name = normalizeName(value);
  if (!name) {
    throw new ApiError(400, `${label}不能为空`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError(400, `${label}不能超过 ${MAX_NAME_LENGTH} 个字`);
  }
  return name;
};

const requireTitle = (value) => {
  const title = normalizeName(value);
  if (!title) {
    throw new ApiError(400, '待办内容不能为空');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ApiError(400, `待办内容不能超过 ${MAX_TITLE_LENGTH} 个字`);
  }
  return title;
};

const toTask = (row) => ({
  id: row.id,
  title: row.title,
  assignee: row.assignee,
  createdAt: row.created_at,
  completedAt: row.completed_at,
  completedBy: row.completed_by,
});

const toHandover = (row) => ({
  id: row.id,
  fromPerson: row.from_person,
  toPerson: row.to_person,
  transferredCount: row.transferred_count,
  createdAt: row.created_at,
});

const getCurrentPerson = async (queryable) => {
  const { rows } = await queryable.query(
    'SELECT current_person FROM care_state WHERE id = 1'
  );
  return rows.length > 0 ? rows[0].current_person : null;
};

const getBoard = async (queryable) => {
  const [currentPerson, pending, completed, handovers] = await Promise.all([
    getCurrentPerson(queryable),
    queryable.query(
      "SELECT id, title, assignee, created_at FROM care_tasks WHERE status = 'pending' ORDER BY id"
    ),
    queryable.query(
      "SELECT id, title, assignee, created_at, completed_at, completed_by FROM care_tasks WHERE status = 'completed' ORDER BY completed_at DESC, id DESC"
    ),
    queryable.query(
      'SELECT id, from_person, to_person, transferred_count, created_at FROM care_handovers ORDER BY id DESC'
    ),
  ]);

  return {
    currentPerson,
    pendingCount: pending.rows.length,
    lastHandoverAt: handovers.rows.length > 0 ? handovers.rows[0].created_at : null,
    pendingTasks: pending.rows.map(toTask),
    completedTasks: completed.rows.map(toTask),
    handovers: handovers.rows.map(toHandover),
  };
};

const setInitialPerson = async (queryable, name) => {
  const person = requireName(name, '负责人姓名');
  const existing = await getCurrentPerson(queryable);
  if (existing) {
    throw new ApiError(409, '已设置负责人，换人请使用交接功能');
  }
  try {
    await queryable.query(
      'INSERT INTO care_state (id, current_person) VALUES (1, $1)',
      [person]
    );
  } catch (err) {
    // 并发下另一请求已写入负责人（唯一约束冲突）
    if (err && err.code === '23505') {
      throw new ApiError(409, '已设置负责人，换人请使用交接功能');
    }
    throw err;
  }
  return person;
};

const addTask = async (queryable, title) => {
  const currentPerson = await getCurrentPerson(queryable);
  if (!currentPerson) {
    throw new ApiError(409, '请先设置当前负责人，再添加待办事项');
  }
  const { rows } = await queryable.query(
    "INSERT INTO care_tasks (title, assignee) VALUES ($1, $2) RETURNING id, title, assignee, created_at",
    [requireTitle(title), currentPerson]
  );
  return toTask(rows[0]);
};

const completeTask = async (queryable, taskId) => {
  const id = Number(taskId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, '事项编号无效');
  }
  const currentPerson = await getCurrentPerson(queryable);
  if (!currentPerson) {
    throw new ApiError(409, '请先设置当前负责人');
  }
  const { rowCount } = await queryable.query(
    "UPDATE care_tasks SET status = 'completed', completed_at = now(), completed_by = $1 WHERE id = $2 AND status = 'pending'",
    [currentPerson, id]
  );
  if (rowCount === 0) {
    const existing = await queryable.query('SELECT status FROM care_tasks WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      throw new ApiError(404, '待办事项不存在');
    }
    throw new ApiError(409, '该事项已完成');
  }
};

const handover = async (pool, toPersonValue) => {
  const toPerson = requireName(toPersonValue, '接手人姓名');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fromPerson = await getCurrentPerson(client);
    if (!fromPerson) {
      throw new ApiError(409, '尚未设置当前负责人，无法交接');
    }
    if (toPerson === fromPerson) {
      throw new ApiError(409, '接手人仍是当前负责人，无需交接');
    }

    const pending = await client.query(
      "SELECT id FROM care_tasks WHERE status = 'pending' ORDER BY id"
    );
    if (pending.rows.length === 0) {
      throw new ApiError(409, '当前没有待办事项，无法交接');
    }

    await client.query(
      "UPDATE care_tasks SET assignee = $1 WHERE status = 'pending'",
      [toPerson]
    );
    await client.query(
      'UPDATE care_state SET current_person = $1, updated_at = now() WHERE id = 1',
      [toPerson]
    );
    const { rows } = await client.query(
      'INSERT INTO care_handovers (from_person, to_person, transferred_count) VALUES ($1, $2, $3) RETURNING id, from_person, to_person, transferred_count, created_at',
      [fromPerson, toPerson, pending.rows.length]
    );

    await client.query('COMMIT');
    return toHandover(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  ApiError,
  getBoard,
  setInitialPerson,
  addTask,
  completeTask,
  handover,
};
