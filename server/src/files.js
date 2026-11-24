// File storage on local disk: public files (logos, doctor photos) and private files (patient charts).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { prisma } from './db.js';
import { badRequest, forbidden, notFound } from './http.js';

export const PUBLIC_DIR = path.join(config.storageDir, 'public');
export const PRIVATE_DIR = path.join(config.storageDir, 'private');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

// Detect the real type from the first bytes (never trust the client's name/mime).
export function sniffType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}

export async function storeUpload(ctx, file, visibility) {
  if (!file) throw badRequest('Choose a file to upload.');
  const type = sniffType(file.buffer);
  if (!type) throw badRequest('Only JPG, PNG, WebP images or PDF files can be uploaded.', 'UNSUPPORTED_FILE');
  if (visibility === 'public' && type.mime === 'application/pdf') throw badRequest('Public uploads must be images.');
  const key = `${crypto.randomBytes(16).toString('hex')}${type.ext}`;
  const dir = visibility === 'public' ? PUBLIC_DIR : PRIVATE_DIR;
  await fsp.writeFile(path.join(dir, key), file.buffer);
  const rec = await prisma.fileObject.create({
    data: {
      facility_id: ctx.facilityId,
      visibility,
      storage_key: key,
      original_name: String(file.originalname || '').slice(0, 200),
      mime_type: type.mime,
      size: file.size,
      uploaded_by: ctx.userId,
    },
  });
  return visibility === 'public' ? { file_url: `/uploads/${key}` } : { file_uri: `private://${rec.id}` };
}

// Looks up a private file the caller's facility owns.
export async function getPrivateFile(ctx, fileUri) {
  const m = /^private:\/\/([a-z0-9]+)$/i.exec(String(fileUri || ''));
  if (!m) throw badRequest('Invalid file reference.');
  const rec = await prisma.fileObject.findUnique({ where: { id: m[1] } });
  if (!rec || rec.visibility !== 'private') throw notFound('File not found.');
  if (rec.facility_id !== ctx.facilityId) throw forbidden();
  return { ...rec, path: path.join(PRIVATE_DIR, rec.storage_key) };
}

export function signFileUrl(rec) {
  const token = jwt.sign({ fid: rec.id, p: 'file' }, config.jwtSecret, { expiresIn: '10m' });
  return `/api/files/private/${rec.id}?token=${encodeURIComponent(token)}`;
}

export function verifyFileToken(id, token) {
  try {
    const payload = jwt.verify(String(token || ''), config.jwtSecret);
    return payload.p === 'file' && payload.fid === id;
  } catch {
    return false;
  }
}
