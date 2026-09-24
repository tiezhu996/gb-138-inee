import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/handover';
const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-6">⚠️</span>
        <p className="text-sm leading-6">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors text-lg leading-6"
          aria-label="关闭提示"
        >
          ×
        </button>
      )}
    </div>
  );
};

const StartPanel = ({ onStarted }) => {
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const board = await api.startBoard(owner);
      onStarted(board);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-10 shadow-xl border border-white/60 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 text-3xl shadow-lg mb-5">
        🤝
      </div>
      <h3 className="text-2xl font-bold text-warm-800 mb-3">开始第一次接班</h3>
      <p className="text-warm-600 leading-relaxed max-w-md mx-auto mb-8">
        请第一位接班的家人登记姓名。之后可以写下待办事项，并在收班时交接给下一位家人。
      </p>
      <form onSubmit={submit} className="max-w-sm mx-auto space-y-4">
        <input
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          placeholder="请输入接班家属姓名"
          maxLength={20}
          className="w-full px-5 py-3.5 rounded-2xl border border-warm-200 bg-white/90 text-warm-800 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
        />
        <ErrorBanner message={error} onDismiss={() => setError('')} />
        <button
          type="submit"
          disabled={busy || !owner.trim()}
          className="w-full px-6 py-3.5 rounded-2xl font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-500 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {busy ? '登记中…' : '登记并开始照护'}
        </button>
      </form>
    </div>
  );
};

const StatusCard = ({ board }) => (
  <div className="grid sm:grid-cols-3 gap-4">
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/60">
      <p className="text-xs text-warm-500 mb-2 flex items-center gap-1.5">
        <span>👤</span>当前负责人
      </p>
      <p className="text-xl font-bold text-emerald-700 break-all">{board.currentOwner}</p>
    </div>
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/60">
      <p className="text-xs text-warm-500 mb-2 flex items-center gap-1.5">
        <span>📝</span>待办数量
      </p>
      <p className="text-xl font-bold text-amber-600">{board.pendingCount} 项</p>
    </div>
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/60">
      <p className="text-xs text-warm-500 mb-2 flex items-center gap-1.5">
        <span>🕒</span>最近一次交接
      </p>
      <p className="text-xl font-bold text-warm-800">
        {board.lastHandoverAt ? formatTime(board.lastHandoverAt) : '暂无交接记录'}
      </p>
    </div>
  </div>
);

const AddTodoForm = ({ board, onChanged }) => {
  const [content, setContent] = useState('');
  const [owner, setOwner] = useState('');
  const [newMember, setNewMember] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ownerValue = owner === '__new__' ? newMember.trim() : owner;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const next = await api.addTodo(content, ownerValue);
      setContent('');
      setOwner('');
      setNewMember('');
      onChanged(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/60"
    >
      <h3 className="text-lg font-bold text-warm-800 mb-4 flex items-center gap-2">
        <span>✍️</span>写下待办事项
      </h3>
      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="例如：上午十点翻身拍背、下午三点喂药…"
          maxLength={100}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border border-warm-200 bg-white/90 text-warm-800 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition resize-none"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="px-4 py-3 rounded-2xl border border-warm-200 bg-white/90 text-warm-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition sm:w-48"
          >
            <option value="">交代给：{board.currentOwner}（自己）</option>
            {board.members
              .filter((name) => name !== board.currentOwner)
              .map((name) => (
                <option key={name} value={name}>
                  交代给：{name}
                </option>
              ))}
            <option value="__new__">➕ 交代给其他家人…</option>
          </select>
          {owner === '__new__' && (
            <input
              value={newMember}
              onChange={(event) => setNewMember(event.target.value)}
              placeholder="输入这位家人的姓名"
              maxLength={20}
              className="flex-1 px-4 py-3 rounded-2xl border border-warm-200 bg-white/90 text-warm-800 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          )}
          <button
            type="submit"
            disabled={busy || !content.trim() || (owner === '__new__' && !newMember.trim())}
            className="px-6 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed sm:ml-auto"
          >
            {busy ? '保存中…' : '添加待办'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <ErrorBanner message={error} onDismiss={() => setError('')} />
      </div>
    </form>
  );
};

const TodoList = ({ board, onChanged, onError }) => {
  const [busyId, setBusyId] = useState(null);

  const complete = async (id) => {
    if (busyId) return;
    setBusyId(id);
    try {
      onChanged(await api.completeTodo(id));
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (board.todos.length === 0) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-10 text-center border border-dashed border-emerald-200">
        <p className="text-4xl mb-3">🌿</p>
        <p className="text-warm-500">还没有待办事项，接班后请把口头交代的内容写下来。</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {board.todos.map((todo) => {
        const mine = todo.owner === board.currentOwner;
        const done = todo.status === 'done';
        return (
          <li
            key={todo.id}
            className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-md border flex flex-col sm:flex-row sm:items-center gap-4 ${
              done ? 'border-emerald-100 opacity-70' : 'border-white/60'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-warm-800 leading-relaxed break-words ${done ? 'line-through' : ''}`}>
                {todo.content}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-warm-500">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                    mine ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {mine ? '🙋 我的事项' : `👤 ${todo.owner} 的事项`}
                </span>
                <span>{todo.createdBy} 记录于 {formatTime(todo.createdAt)}</span>
                {done && <span className="text-emerald-600 font-medium">✅ 已于 {formatTime(todo.completedAt)} 完成</span>}
              </div>
            </div>
            {!done && mine && (
              <button
                type="button"
                onClick={() => complete(todo.id)}
                disabled={busyId === todo.id}
                className="px-5 py-2.5 rounded-xl font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {busyId === todo.id ? '提交中…' : '✅ 标记完成'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const HandoverPanel = ({ board, onChanged }) => {
  const [nextOwner, setNextOwner] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const otherMembers = useMemo(
    () => board.members.filter((name) => name !== board.currentOwner),
    [board.members, board.currentOwner],
  );

  const target = nextOwner === '__new__' ? newOwner.trim() : nextOwner;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      onChanged(await api.handover(target));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-3xl p-7 shadow-xl text-white"
    >
      <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
        <span>🔄</span>收班交接
      </h3>
      <p className="text-white/85 text-sm leading-relaxed mb-5">
        交接后，当前 {board.pendingCount} 项未完成事项将全部转给接手人；本轮已完成的事项会归入档案，本次交接也会留档。
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={nextOwner}
          onChange={(event) => setNextOwner(event.target.value)}
          className="px-4 py-3 rounded-2xl bg-white/95 text-warm-800 focus:outline-none focus:ring-2 focus:ring-white sm:w-52"
        >
          <option value="">请选择接手的家人…</option>
          {otherMembers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="__new__">➕ 其他家人…</option>
        </select>
        {nextOwner === '__new__' && (
          <input
            value={newOwner}
            onChange={(event) => setNewOwner(event.target.value)}
            placeholder="输入接手家人的姓名"
            maxLength={20}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/95 text-warm-800 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-white"
          />
        )}
        <button
          type="submit"
          disabled={busy || !target}
          className="px-6 py-3 rounded-2xl font-semibold bg-white text-violet-700 shadow-lg hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:ml-auto"
        >
          {busy ? '交接中…' : '确认交接'}
        </button>
      </div>
      {error && (
        <div className="mt-4">
          <div className="flex items-start justify-between gap-3 bg-white/95 text-red-700 rounded-2xl px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-6">⚠️</span>
              <p className="text-sm leading-6">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 transition-colors text-lg leading-6"
              aria-label="关闭提示"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

const ArchiveSection = ({ board }) => {
  const [showTodos, setShowTodos] = useState(false);
  if (board.handovers.length === 0 && board.archivedTodos.length === 0) return null;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-7 shadow-lg border border-white/60">
      <h3 className="text-lg font-bold text-warm-800 mb-5 flex items-center gap-2">
        <span>🗂️</span>交接与完成档案
      </h3>

      {board.handovers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-warm-600 mb-3">交接记录</h4>
          <ol className="relative border-l-2 border-violet-200 ml-2 space-y-5">
            {board.handovers.map((record) => (
              <li key={record.id} className="pl-5 relative">
                <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-violet-400 ring-4 ring-violet-100" />
                <p className="text-warm-800 font-medium">
                  {record.from} <span className="text-violet-500">→</span> {record.to}
                </p>
                <p className="text-sm text-warm-500 mt-1">{formatTime(record.at)}</p>
                <p className="text-sm text-warm-600 mt-1.5">
                  转交未完成事项 <span className="font-semibold text-amber-600">{record.transferredCount}</span> 项，
                  归档已完成事项 <span className="font-semibold text-emerald-600">{record.completedCount}</span> 项
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {board.archivedTodos.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowTodos((value) => !value)}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
          >
            <span>{showTodos ? '▾' : '▸'}</span>
            已完成事项档案（{board.archivedTodos.length} 项）
          </button>
          {showTodos && (
            <ul className="mt-3 space-y-2">
              {board.archivedTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm bg-emerald-50/60 rounded-xl px-4 py-3"
                >
                  <span className="text-warm-700 line-through flex-1">{todo.content}</span>
                  <span className="text-warm-500 text-xs whitespace-nowrap">
                    {todo.owner} 完成于 {formatTime(todo.completedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const HandoverBoard = () => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    return api
      .fetchBoard()
      .then((data) => {
        setBoard(data);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const promise = load();
    return () => promise.cancel?.();
  }, [load]);

  const applyBoard = useCallback((next) => {
    setBoard(next);
    setLoadError('');
  }, []);

  const handleListError = useCallback((message) => {
    setLoadError(message);
  }, []);

  if (loading) {
    return (
      <div className="bg-white/70 rounded-3xl p-16 text-center shadow-lg">
        <p className="text-warm-500">正在加载照护交接板…</p>
      </div>
    );
  }

  if (loadError && !board) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} />
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="px-6 py-3 rounded-2xl font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!board.initialized) {
    return (
      <div className="space-y-4">
        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}
        <StartPanel onStarted={applyBoard} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}
      <StatusCard board={board} />
      <AddTodoForm board={board} onChanged={applyBoard} />
      <section>
        <h3 className="text-lg font-bold text-warm-800 mb-3 flex items-center gap-2 px-1">
          <span>📋</span>事项清单
          <span className="text-sm font-normal text-warm-500">（待办 {board.pendingCount} 项）</span>
        </h3>
        <TodoList board={board} onChanged={applyBoard} onError={handleListError} />
      </section>
      <HandoverPanel key={board.currentOwner} board={board} onChanged={applyBoard} />
      <ArchiveSection board={board} />
    </div>
  );
};

export default HandoverBoard;
