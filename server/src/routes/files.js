import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireFacility } from '../auth.js';
import { badRequest, notFound } from '../http.js';
import { storeUpload, getPrivateFile, signFileUrl, verifyFileToken, PRIVATE_DIR } from '../files.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

router.post('/upload', requireAuth, requireFacility, upload.single('file'), async (req, res) => {
  const visibility = req.query.visibility === 'public' ? 'public' : 'private';
  res.status(201).json(await storeUpload(req.ctx, req.file, visibility));
});

router.post('/signed-url', requireAuth, requireFacility, async (req, res) => {
  const rec = await getPrivateFile(req.ctx, req.body?.file_uri);
  res.json({ signed_url: signFileUrl(rec) });
});

// Short-lived link produced by /signed-url (works in <img>/<a> without the session cookie).
router.get('/private/:id', async (req, res) => {
  if (!verifyFileToken(req.params.id, req.query.token)) throw badRequest('This link has expired.', 'LINK_EXPIRED');
  const rec = await prisma.fileObject.findUnique({ where: { id: req.params.id } });
  if (!rec || rec.visibility !== 'private') throw notFound();
  res.setHeader('Content-Type', rec.mime_type);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="chart-${rec.id}${rec.mime_type === 'application/pdf' ? '.pdf' : ''}"`);
  res.sendFile(rec.storage_key, { root: PRIVATE_DIR, dotfiles: 'deny' });
});

export default router;
