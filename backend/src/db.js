const { Pool } = require('pg');
const config = require('./config');
const logger = require('./logger');

const createPool = () =>
  new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS care_state (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_person TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS care_tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    assignee TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    completed_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS care_handovers (
    id SERIAL PRIMARY KEY,
    from_person TEXT NOT NULL,
    to_person TEXT NOT NULL,
    transferred_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureSchema = async (pool, { retries = 15, delayMs = 1000 } = {}) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      for (const statement of SCHEMA_STATEMENTS) {
        // eslint-disable-next-line no-await-in-loop
        await pool.query(statement);
      }
      logger.info('care board schema is ready');
      return;
    } catch (err) {
      if (attempt >= retries) {
        throw err;
      }
      logger.info(`waiting for database (attempt ${attempt}/${retries}): ${err.message}`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(delayMs);
    }
  }
};

module.exports = {
  createPool,
  ensureSchema,
  SCHEMA_STATEMENTS,
};
