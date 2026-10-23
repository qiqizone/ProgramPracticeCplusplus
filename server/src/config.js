import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && !isTest) {
  throw new Error('缺少环境变量 JWT_SECRET，请复制 .env.example 为 .env 并填写');
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.DB_PATH || './data/app.db',
  jwtSecret: jwtSecret || 'test-secret',
  jwtExpiresIn: '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isTest,
};
