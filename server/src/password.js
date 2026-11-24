import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { badRequest } from './http.js';

// 8+ characters with at least one uppercase letter, one number and one special character.
export const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_HINT =
  'Password must be at least 8 characters and include one uppercase letter, one number and one special character.';

export const assertPasswordPolicy = (password) => {
  if (typeof password !== 'string' || password.length > 128 || !PASSWORD_RULE.test(password)) {
    throw badRequest(PASSWORD_HINT, 'WEAK_PASSWORD');
  }
};

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

// Random token for reset links; only its SHA-256 is stored.
export const newResetToken = () => {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
};
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
