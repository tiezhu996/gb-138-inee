const crypto = require('node:crypto');
const store = require('./store');

class HandoverError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'HandoverError';
    this.status = status;
  }
}

const MAX_NAME_LENGTH = 20;
const MAX_CONTENT_LENGTH = 100;
const MAX_HANDOVERS = 200;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const validateName = (value, label = '姓名') => {
  const name = trim(value);
  if (!name) {
    throw new HandoverError(`请填写${label}`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new HandoverError(`${label}不能超过 ${MAX_NAME_LENGTH} 个字`);
  }
  return name;
};

const nowIso = () => new Date().toISOString();

const genId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

// 已完成事项的留档记录（随交接归入档案）
const toArchivedTodo = (todo) => ({
  id: todo.id,
  content: todo.content,
  owner: todo.owner,
  createdBy: todo.createdBy,
  createdAt: todo.createdAt,
  completedAt: todo.completedAt,
});

const toPublicState = (state) => ({
  initialized: state.initialized,
  members: state.members,
  currentOwner: state.currentOwner,
  todos: state.todos,
  archivedTodos: state.archivedTodos,
  handovers: state.handovers,
  lastHandoverAt: state.lastHandoverAt,
  pendingCount: state.todos.filter((todo) => todo.status === 'pending').length,
});

const getBoard = () => toPublicState(store.getState());

// 第一次使用：接班家属登记姓名，成为当前负责人
const startBoard = (body) => {
  const state = store.getState();
  if (state.initialized) {
    throw new HandoverError('交接板已在使用中，无需重新登记', 409);
  }
  const owner = validateName(body && body.owner, '接班家属姓名');
  const timestamp = nowIso();
  state.initialized = true;
  state.createdAt = timestamp;
  state.members = [owner];
  state.currentOwner = owner;
  return store.persist().then(() => toPublicState(state));
};

// 接班家属写下待办（默认记在当前负责人名下，也可代其他家人记下）
const addTodo = (body) => {
  const state = store.getState();
  if (!state.initialized) {
    throw new HandoverError('交接板尚未开始，请先登记接班家属');
  }
  const content = trim(body && body.content);
  if (!content) {
    throw new HandoverError('请填写待办内容');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new HandoverError(`待办内容不能超过 ${MAX_CONTENT_LENGTH} 个字`);
  }
  let owner = trim(body && body.owner);
  if (!owner) {
    owner = state.currentOwner;
  } else {
    owner = validateName(owner, '被交代人姓名');
    if (!state.members.includes(owner)) {
      state.members.push(owner);
    }
  }
  const todo = {
    id: genId('todo'),
    content,
    owner,
    createdBy: state.currentOwner,
    status: 'pending',
    createdAt: nowIso(),
    completedAt: null,
  };
  state.todos.push(todo);
  return store.persist().then(() => toPublicState(state));
};

// 当前负责人完成自己名下的事项
const completeTodo = (id) => {
  const state = store.getState();
  if (!state.initialized) {
    throw new HandoverError('交接板尚未开始，请先登记接班家属');
  }
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) {
    throw new HandoverError('没有找到这条待办', 404);
  }
  if (todo.status === 'done') {
    throw new HandoverError('该事项已完成');
  }
  if (todo.owner !== state.currentOwner) {
    throw new HandoverError('只能完成自己名下的事项');
  }
  todo.status = 'done';
  todo.completedAt = nowIso();
  return store.persist().then(() => toPublicState(state));
};

// 收班交接：必须有待办，且接手人必须是另一位家人。
// 全部校验通过后才变更：未完成事项转给接手人，已完成事项归档，留档交接记录。
const handover = (body) => {
  const state = store.getState();
  if (!state.initialized) {
    throw new HandoverError('交接板尚未开始，请先登记接班家属');
  }
  const nextOwner = validateName(body && body.nextOwner, '接手人姓名');

  const pendingTodos = state.todos.filter((todo) => todo.status === 'pending');
  if (pendingTodos.length === 0) {
    throw new HandoverError('当前没有待办事项，请先添加待办后再交接');
  }
  if (nextOwner === state.currentOwner) {
    throw new HandoverError('接手人仍是当前负责人，请选择另一位家人');
  }

  // 以下为校验通过后的唯一变更区：任一步骤都不应再抛错。
  const previousOwner = state.currentOwner;
  const timestamp = nowIso();

  const completedTodos = state.todos.filter((todo) => todo.status === 'done');
  state.archivedTodos.push(...completedTodos.map(toArchivedTodo));

  const transferredIds = pendingTodos.map((todo) => {
    todo.owner = nextOwner;
    return todo.id;
  });

  const record = {
    id: genId('handover'),
    from: previousOwner,
    to: nextOwner,
    transferredCount: transferredIds.length,
    transferredIds,
    completedCount: completedTodos.length,
    transferredItems: pendingTodos.map((todo) => ({ id: todo.id, content: todo.content })),
    archivedItems: completedTodos.map((todo) => ({ id: todo.id, content: todo.content })),
    at: timestamp,
  };
  state.handovers.unshift(record);
  if (state.handovers.length > MAX_HANDOVERS) {
    state.handovers = state.handovers.slice(0, MAX_HANDOVERS);
  }

  if (!state.members.includes(nextOwner)) {
    state.members.push(nextOwner);
  }
  state.todos = pendingTodos;
  state.currentOwner = nextOwner;
  state.lastHandoverAt = timestamp;

  return store.persist().then(() => toPublicState(state));
};

module.exports = {
  HandoverError,
  startBoard,
  addTodo,
  completeTodo,
  handover,
  getBoard,
};
