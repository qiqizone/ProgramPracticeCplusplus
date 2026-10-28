import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';

if (config.dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });
}

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(SCHEMA);

// 兼容旧库：knowledge_points 增加 reference_url 列
const knowledgeColumns = db.prepare('PRAGMA table_info(knowledge_points)').all();
if (!knowledgeColumns.some((column) => column.name === 'reference_url')) {
  db.exec('ALTER TABLE knowledge_points ADD COLUMN reference_url TEXT');
}

export default db;
