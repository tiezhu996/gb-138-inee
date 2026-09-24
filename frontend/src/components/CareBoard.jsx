import { useCallback, useEffect, useMemo, useState } from 'react';

const apiRequest = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || '请求失败，请稍后再试');
  }
  return body;
};

const post = (path, payload) =>
  apiRequest(path, { method: 'POST', body: JSON.stringify(payload) });

const formatTime = (value) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';

const CareBoard = () => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [setupName, setSetupName] = useState('');
  const [newTask, setNewTask] = useState('');
  const [toPerson, setToPerson] = useState('');
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const data = await apiRequest('/api/care/board');
      setBoard(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 首次挂载时拉取交接板数据（异步请求，非同步 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBoard();
  }, [loadBoard]);

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await loadBoard();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSetPerson = () => {
    if (!setupName.trim()) return;
    runAction(async () => {
      await post('/api/care/person', { name: setupName.trim() });
      setSetupName('');
    });
  };

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    runAction(async () => {
      await post('/api/care/tasks', { title: newTask.trim() });
      setNewTask('');
    });
  };

  const handleComplete = (taskId) => {
    runAction(() => post(`/api/care/tasks/${taskId}/complete`, {}));
  };

  const handleHandover = () => {
    const target = toPerson.trim();
    if (!target) return;
    if (!window.confirm(`确认交接给「${target}」吗？未完成的待办事项将一并转交。`)) return;
    runAction(async () => {
      await post('/api/care/handover', { toPerson: target });
      setToPerson('');
    });
  };

  const memberSuggestions = useMemo(() => {
    if (!board) return [];
    const names = new Set();
    board.handovers.forEach((h) => {
      names.add(h.fromPerson);
      names.add(h.toPerson);
    });
    board.completedTasks.forEach((t) => t.completedBy && names.add(t.completedBy));
    if (board.currentPerson) names.delete(board.currentPerson);
    return [...names];
  }, [board]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-10 mb-4 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-5">
            <span className="text-4xl">🤝</span>
          </div>
          <h3 className="text-3xl font-bold mb-4">照护交接板</h3>
          <p className="text-white/90 text-lg leading-relaxed">
            家属轮流照护时，把待办事项写在交接板上，不再依赖口头交代。
            收班时交接给下一位家人，未完成的事项会一起转过去，已完成事项和每次交接都会留档。
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold">操作未完成</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-16 text-center border border-white/60">
          <p className="text-warm-500 text-lg">正在加载交接板...</p>
        </div>
      ) : !board ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-16 text-center border border-white/60">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-2xl font-bold text-warm-800 mb-3">暂时无法连接服务</h3>
          <p className="text-warm-500 mb-6">请检查后端服务是否已启动，然后重试。</p>
          <button
            onClick={loadBoard}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold hover:shadow-xl transition-all duration-300"
          >
            重新加载
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/60 text-center">
              <div className="text-3xl mb-2">🧑‍🤝‍🧑</div>
              <p className="text-sm text-warm-500 mb-1">当前负责人</p>
              <p className="text-2xl font-bold text-emerald-600">
                {board.currentPerson || '未设置'}
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/60 text-center">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm text-warm-500 mb-1">待办事项</p>
              <p className="text-2xl font-bold text-emerald-600">{board.pendingCount} 项</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/60 text-center">
              <div className="text-3xl mb-2">🕐</div>
              <p className="text-sm text-warm-500 mb-1">最近一次交接</p>
              <p className="text-lg font-bold text-emerald-600">
                {board.lastHandoverAt ? formatTime(board.lastHandoverAt) : '暂无交接'}
              </p>
            </div>
          </div>

          {!board.currentPerson ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
              <h4 className="text-xl font-bold text-warm-800 mb-2">开始第一班</h4>
              <p className="text-warm-500 mb-5">先设置当前照护负责人，之后就能记录待办并交接班。</p>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPerson()}
                  placeholder="负责人称呼，如：妈妈"
                  className="flex-1 px-5 py-4 rounded-2xl border-2 border-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all outline-none text-lg bg-white/50"
                />
                <button
                  onClick={handleSetPerson}
                  disabled={!setupName.trim() || busy}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  开始值班
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
                <h4 className="text-xl font-bold text-warm-800 mb-2">写下待办事项</h4>
                <p className="text-warm-500 mb-5">
                  事项会记在「{board.currentPerson}」名下，由当前负责人逐项完成。
                </p>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="如：晚上8点喂药、翻身拍背..."
                    className="flex-1 px-5 py-4 rounded-2xl border-2 border-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all outline-none text-lg bg-white/50"
                  />
                  <button
                    onClick={handleAddTask}
                    disabled={!newTask.trim() || busy}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xl font-bold text-warm-800">待办事项</h4>
                  <span className="text-sm text-warm-500">
                    {board.pendingCount > 0 ? `${board.pendingCount} 项待完成` : '全部完成'}
                  </span>
                </div>
                {board.pendingTasks.length === 0 ? (
                  <p className="text-warm-400 text-center py-6">
                    暂无待办事项。收班前如有未交接的事项，请先添加。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {board.pendingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 bg-emerald-50/60 rounded-2xl px-5 py-4 border border-emerald-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-lg text-warm-800 font-medium">{task.title}</p>
                          <p className="text-sm text-warm-400 mt-0.5">
                            {task.assignee} · 记录于 {formatTime(task.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleComplete(task.id)}
                          disabled={busy}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          完成
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
                <h4 className="text-xl font-bold text-warm-800 mb-2">收班交接</h4>
                <p className="text-warm-500 mb-5">
                  选择下一位家人接手。未完成的 {board.pendingCount} 项待办会一起转过去，
                  本次交接会留档。没有待办事项时不能交接。
                </p>
                <div className="flex gap-4">
                  <input
                    type="text"
                    list="care-member-suggestions"
                    value={toPerson}
                    onChange={(e) => setToPerson(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHandover()}
                    placeholder="接手人称呼，如：爸爸"
                    className="flex-1 px-5 py-4 rounded-2xl border-2 border-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all outline-none text-lg bg-white/50"
                  />
                  <datalist id="care-member-suggestions">
                    {memberSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <button
                    onClick={handleHandover}
                    disabled={!toPerson.trim() || busy}
                    className="px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    交接班
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
                  <h4 className="text-xl font-bold text-warm-800 mb-5">✅ 已完成留档</h4>
                  {board.completedTasks.length === 0 ? (
                    <p className="text-warm-400 text-center py-4">还没有完成的事项</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {board.completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-warm-50 rounded-2xl px-5 py-3.5 border border-warm-100"
                        >
                          <p className="text-warm-500 line-through">{task.title}</p>
                          <p className="text-sm text-warm-400 mt-0.5">
                            {task.completedBy} 完成于 {formatTime(task.completedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
                  <h4 className="text-xl font-bold text-warm-800 mb-5">📜 交接记录</h4>
                  {board.handovers.length === 0 ? (
                    <p className="text-warm-400 text-center py-4">还没有交接记录</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {board.handovers.map((record) => (
                        <div
                          key={record.id}
                          className="bg-emerald-50/60 rounded-2xl px-5 py-3.5 border border-emerald-100"
                        >
                          <p className="text-warm-800 font-medium">
                            {record.fromPerson} → {record.toPerson}
                          </p>
                          <p className="text-sm text-warm-400 mt-0.5">
                            转交 {record.transferredCount} 项待办 · {formatTime(record.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CareBoard;
