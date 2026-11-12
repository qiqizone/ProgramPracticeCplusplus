import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';

// 本地免登录模式下使用的固定用户：沿用库里最早的账号，没有则自动创建
function localUser() {
  let user = db
    .prepare('SELECT id, username, role FROM users ORDER BY id LIMIT 1')
    .get();

  if (!user) {
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role) VALUES ('local', 'local-mode', 'admin')")
      .run();
    user = { id: Number(info.lastInsertRowid), username: 'local', role: 'admin' };
  }

  return user;
}

export function authenticate(req, _res, next) {
  if (config.localMode) {
    req.user = localUser();
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'UNAUTHORIZED', '请先登录');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'TOKEN_INVALID', '登录已过期，请重新登录');
  }

  // token 有效但用户已被删除时，必须以 401 让前端清理登录态，避免写入外键失败
  const user = db
    .prepare('SELECT id, username, role FROM users WHERE id = ?')
    .get(Number(payload.sub));
  if (!user) {
    throw new HttpError(401, 'TOKEN_INVALID', '登录已过期，请重新登录');
  }

  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', '需要管理员权限');
  }
  next();
}
