import express from 'express';
import { getCurrentUser } from '../controllers/user.controller';
import { attachTenantDb } from '../middleware/tenantDb.middleware';

const router = express.Router();


router.use(attachTenantDb);

router.get('/me', getCurrentUser); // Uses middleware-injected tenant DB

export default router;
