import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

export function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  if (err instanceof ZodError) {
    const first = err.errors[0];
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: first?.message || '参数不合法' },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: '请求体不是合法 JSON' } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
}
