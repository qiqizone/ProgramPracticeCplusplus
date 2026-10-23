import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';

export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'UNAUTHORIZED', '请先登录');
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      role: payload.role,
    };
  } catch {
    throw new HttpError(401, 'TOKEN_INVALID', '登录已过期，请重新登录');
  }

  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', '需要管理员权限');
  }
  next();
}
