const API_BASE = import.meta.env.VITE_API_BASE || '';

const request = async (path, options = {}) => {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('无法连接服务器，请检查后端服务是否已启动');
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    throw new Error(payload?.error || `请求失败（${res.status}）`);
  }
  return payload.data;
};

export const fetchBoard = () => request('/api/handover');

export const startBoard = (owner) =>
  request('/api/handover/start', {
    method: 'POST',
    body: JSON.stringify({ owner }),
  });

export const addTodo = (content, owner) =>
  request('/api/handover/todos', {
    method: 'POST',
    body: JSON.stringify({ content, owner: owner || undefined }),
  });

export const completeTodo = (id) =>
  request(`/api/handover/todos/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
  });

export const handover = (nextOwner) =>
  request('/api/handover/handover', {
    method: 'POST',
    body: JSON.stringify({ nextOwner }),
  });
