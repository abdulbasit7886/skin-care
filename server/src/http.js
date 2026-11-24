// Error type + Express error handler producing `{ error: { code, message } }`.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') => new HttpError(400, code, message);
export const unauthorized = (message = 'Please log in.', code = 'UNAUTHORIZED') => new HttpError(401, code, message);
export const forbidden = (message = 'You do not have permission to do this.', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Not found.', code = 'NOT_FOUND') => new HttpError(404, code, message);

// Express recognises error handlers by their four parameters.
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body.' } });
  }
  // Errors from Express/static middleware carry their own 4xx status (e.g. a missing upload → 404).
  const status = err?.status || err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500 && err?.code !== 'LIMIT_FILE_SIZE') {
    return res.status(status).json({
      error: { code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: status === 404 ? 'Not found.' : 'Bad request.' },
    });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File is too large (max 15 MB).' } });
  }
  // Prisma known request errors
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
    return res.status(409).json({ error: { code: 'DUPLICATE', message: `That ${target} is already in use.` } });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }
  if (err?.name === 'PrismaClientValidationError') {
    console.warn('[validation]', err.message.split('\n').slice(-3).join(' '));
    return res.status(400).json({ error: { code: 'INVALID_DATA', message: 'Some fields have invalid values.' } });
  }
  console.error('[error]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on the server.' } });
}
