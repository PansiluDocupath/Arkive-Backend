// src/routes/auth/organizations.ts

import express, { Request, Response } from 'express';
import { getManagementApiToken } from '../../services/auth0'; // ✅ import mgmt token function

const router = express.Router();

/**
 * GET /api/auth/organizations
 * Public route (no verifyToken) to fetch all Auth0 orgs for selection
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const token = await getManagementApiToken(); // ✅ use reusable token function
    const domain = process.env.AUTH0_DOMAIN;

    const orgRes = await fetch(`https://${domain}/api/v2/organizations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orgRes.ok) {
      const errorText = await orgRes.text();
      console.error(`[GET /organizations] Auth0 API error: ${errorText}`);
      res.status(500).json({ error: 'Failed to fetch organizations', detail: errorText });
      return;
    }

    const orgs = await orgRes.json() as { id: string; name: string; display_name?: string }[];

    if (!Array.isArray(orgs)) {
      res.status(500).json({ error: 'Unexpected response from Auth0' });
      return;
    }

    const cleaned = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      display_name: org.display_name || org.name,
    }));

    console.log(`[GET /organizations] Returned ${cleaned.length} organizations`);
    res.status(200).json(cleaned);
  } catch (err: any) {
    console.error('[GET /organizations] Unexpected error:', err.message);
    res.status(500).json({ error: 'Failed to fetch organizations', detail: err.message });
  }
});

export default router;