import { Router } from 'express';
import { requireAuth, requireFacility } from '../auth.js';
import { getEntity } from '../entities/registry.js';
import {
  queryEntity, countEntity, aggregateEntity, getEntityRecord,
  createEntity, bulkCreateEntity, updateEntity, deleteEntity,
} from '../entities/service.js';

const router = Router();
router.use(requireAuth, requireFacility);

router.post('/:entity/query', async (req, res) => {
  res.json(await queryEntity(getEntity(req.params.entity), req.ctx, req.body));
});
router.post('/:entity/count', async (req, res) => {
  res.json(await countEntity(getEntity(req.params.entity), req.ctx, req.body));
});
router.post('/:entity/aggregate', async (req, res) => {
  res.json(await aggregateEntity(getEntity(req.params.entity), req.ctx, req.body));
});
router.post('/:entity/bulk', async (req, res) => {
  res.status(201).json(await bulkCreateEntity(getEntity(req.params.entity), req.ctx, req.body));
});
router.get('/:entity/:id', async (req, res) => {
  res.json(await getEntityRecord(getEntity(req.params.entity), req.ctx, req.params.id));
});
router.post('/:entity', async (req, res) => {
  res.status(201).json(await createEntity(getEntity(req.params.entity), req.ctx, req.body));
});
router.patch('/:entity/:id', async (req, res) => {
  res.json(await updateEntity(getEntity(req.params.entity), req.ctx, req.params.id, req.body));
});
router.delete('/:entity/:id', async (req, res) => {
  res.json(await deleteEntity(getEntity(req.params.entity), req.ctx, req.params.id));
});

export default router;
