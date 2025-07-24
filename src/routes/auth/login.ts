// src/routes/auth/login.ts
import express, { Request, Response } from 'express';
import { createAuth0Client } from '../../config/auth0.config';
import { verifyToken } from '../../middleware/verifyToken';
import { createTenantDb } from '../../utils/tenantDb';
import { saveUserIfNotExists } from '../../dbutility/saveUser';

const router = express.Router();

router.post('/login', verifyToken, async (req: Request, res: Response) => {
  const sub = (req as any).user?.sub;

  if (!sub) {
    console.warn('[LOGIN] Missing user sub from verified token');
    return res.status(400).json({ error: 'Missing user identifier (sub)' });
  }

  try {
    const client = await createAuth0Client();
    const userResponse = await client.users.get({ id: sub });
    const user = (userResponse as any)?.data || userResponse;

    const appMetadata = user?.app_metadata || {};
    const approved = appMetadata.approved;
    const orgId = appMetadata.organization_id;

    if (!orgId) {
      console.warn(`[LOGIN] User ${sub} has not selected an organization`);
      return res.status(400).json({ error: 'organization_not_assigned' });
    }

    if (!approved) {
      console.warn(`[LOGIN] User ${sub} is not yet approved by admin`);
      return res.status(403).json({ error: 'not_approved' });
    }

    // Ensure DB exists and connect
    let db;
    try {
      db = await createTenantDb(orgId);
    } catch (dbErr) {
      console.error(`[LOGIN] Failed to initialize tenant DB for org ${orgId}:`, dbErr);
      return res.status(500).json({ error: 'Failed to prepare organization database' });
    }

    // Save user if not exists
    try {
      await saveUserIfNotExists({
        db,
        userId: sub,
        userName: user.username,
        userEmail: user.email,
      });
    } catch (userErr) {
      console.error(`[LOGIN] Failed to save user ${sub}:`, userErr);
      return res.status(500).json({ error: 'Failed to register user in organization database' });
    }

    return res.status(200).json({
      message: 'Login successful',
      orgId,
      userId: sub,
      onboarded: true 
    });

  } catch (err: any) {
    console.error(`[LOGIN ERROR] Unexpected error:`, err?.message || err);
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

export default router;