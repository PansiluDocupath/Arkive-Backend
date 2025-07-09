import { Request, Response, NextFunction } from 'express';
import { getOrCreateTenantDb } from '../database/tenantDbManager';
import { getSession } from '../utils/sessionStore';
import { Knex } from 'knex';

// Extend Request to include tenantDb
declare global {
  namespace Express {
    interface Request {
      tenantDb?: Knex;
    }
  }
}

export const attachTenantDb = (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const session = await getSession();
      
      if (!session) {
        return res.status(403).json({ error: 'No organization ID found in session. Access denied.' });
      }
      
      const orgId = session.organization_id;

      if (!orgId) {
        return res.status(403).json({ error: 'No organization ID found in session. Access denied.' });
      }

      const tenantDb = await getOrCreateTenantDb(orgId);
      req.tenantDb = tenantDb;

      next();
    } catch (err) {
      console.error('Tenant DB middleware error:', err);
      res.status(500).json({ error: 'Failed to resolve tenant database', detail: (err as Error).message });
    }
  })();
};
