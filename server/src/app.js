import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import chaptersRoutes from './routes/chapters.js';
import knowledgeRoutes from './routes/knowledge.js';
import questionsRoutes from './routes/questions.js';
import attemptsRoutes from './routes/attempts.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/chapters', authenticate, chaptersRoutes);
  app.use('/api/knowledge', authenticate, knowledgeRoutes);
  app.use('/api/questions', authenticate, questionsRoutes);
  app.use('/api/attempts', authenticate, attemptsRoutes);
  app.use('/api/stats', authenticate, statsRoutes);
  app.use('/api/admin/questions', authenticate, requireAdmin, adminRoutes);

  // 本地一键启动时直接由后端托管前端构建产物；不存在 dist 时（如开发环境）跳过
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
