import { Router } from 'express';
import { requireAuth, requireFacility, requireRoles } from '../auth.js';
import { notFound } from '../http.js';
import { getPrivateFile } from '../files.js';
import { extractChart } from '../ocr/extract.js';

const router = Router();
router.use(requireAuth, requireFacility);

// Scan Chart: OCR a privately uploaded chart (image or PDF) into reviewable fields.
router.post('/extractPatientChart', requireRoles('super_admin', 'admin', 'doctor', 'reception'), async (req, res) => {
  const file = await getPrivateFile(req.ctx, req.body?.file_uri);
  res.json(await extractChart(file));
});

router.post('/:name', () => {
  throw notFound('Unknown function.');
});

export default router;
