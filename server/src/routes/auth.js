import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/index.js';
import { config } from '../config.js';
import { HttpError, asyncHandler } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' } },
});

const credentials = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,20}$/, '用户名需为 3-20 位字母、数字或下划线'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
});

function issueToken(user) {
  return jwt.sign({ username: user.username, role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role };
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = credentials.parse(req.body);

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) throw new HttpError(409, 'USERNAME_TAKEN', '用户名已被占用');

    const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
    const role = n === 0 ? 'admin' : 'user';
    const passwordHash = await bcrypt.hash(password, config.isTest ? 4 : 12);

    const info = db
      .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, passwordHash, role);

    const user = { id: Number(info.lastInsertRowid), username, role };
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = credentials.parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) throw new HttpError(401, 'INVALID_CREDENTIALS', '用户名或密码错误');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', '用户名或密码错误');

    res.json({ token: issueToken(user), user: publicUser(user) });
  })
);

router.get('/me', authenticate, (req, res) => {
  const user = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', '用户不存在');
  res.json(user);
});

export default router;
