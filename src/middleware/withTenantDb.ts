import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createTenantDb, buildDbName } from '../utils/tenantDb';
import dotenv from 'dotenv';

dotenv.config();

const dbCache = new Map<string, any>(); // In-memory cache to reuse DB connections

export const withTenantDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.decode(token) as any;

    if (!decoded || !decoded.app_metadata?.organizationId) {
      return res.status(403).json({ error: 'Invalid token: organizationId not found in app_metadata' });
    }

    const orgId = decoded.app_metadata.organizationId;
    const dbName = buildDbName(orgId);

    // Reuse DB connection if already created for this org
    let tenantDb = dbCache.get(dbName);
    if (!tenantDb) {
      tenantDb = await createTenantDb(orgId);
      dbCache.set(dbName, tenantDb);
    }

    // Attach DB instance to the request for downstream access
    (req as any).tenantDb = tenantDb;
    (req as any).orgId = orgId;

    next();
  } catch (err) {
    console.error('[withTenantDb] Error:', err);
    res.status(500).json({ error: 'Server error while connecting to tenant database' });
  }
};