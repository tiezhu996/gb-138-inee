const fs = require('node:fs/promises');
const path = require('node:path');
const logger = require('./logger');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'handover.json');

const createInitialState = () => ({
  version: 1,
  initialized: false,
  members: [],
  currentOwner: null,
  todos: [],
  archivedTodos: [],
  handovers: [],
  lastHandoverAt: null,
  createdAt: null,
});

let state = null;
let writeChain = Promise.resolve();

const isUsableState = (data) =>
  data && typeof data === 'object' && Array.isArray(data.todos) && Array.isArray(data.handovers);

const init = async () => {
  if (state) return state;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isUsableState(parsed)) {
      throw new Error('照护交接数据结构不完整');
    }
    state = { ...createInitialState(), ...parsed };
    logger.info(`照护交接数据已加载：${DATA_FILE}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      state = createInitialState();
      logger.info('未找到照护交接数据文件，将从空交接板开始');
    } else {
      const backup = `${DATA_FILE}.corrupt-${Date.now()}`;
      try {
        await fs.rename(DATA_FILE, backup);
        logger.error(`照护交接数据已损坏，已备份至 ${backup}，将从空交接板开始`, error.message);
      } catch {
        logger.error('照护交接数据解析失败，将从空交接板开始', error.message);
      }
      state = createInitialState();
    }
  }
  return state;
};

const getState = () => {
  if (!state) {
    throw new Error('照护交接数据尚未初始化');
  }
  return state;
};

const persist = () => {
  const snapshot = JSON.stringify(state, null, 2);
  const tmpFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  const job = async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(tmpFile, snapshot, 'utf-8');
    await fs.rename(tmpFile, DATA_FILE);
  };
  // 串行化所有写入，避免并发保存互相覆盖；写失败时移除临时文件。
  writeChain = writeChain
    .then(job)
    .catch(async (error) => {
      logger.error('照护交接数据保存失败', error.message);
      try {
        await fs.rm(tmpFile, { force: true });
      } catch {
        // 忽略临时文件清理失败
      }
      throw error;
    });
  return writeChain;
};

module.exports = {
  DATA_FILE,
  init,
  getState,
  persist,
};
