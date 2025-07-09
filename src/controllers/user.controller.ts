import { Request, Response } from 'express';
import { getSession } from '../utils/sessionStore';

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = req.tenantDb;
    if (!db) {
      res.status(500).json({ error: 'Tenant database not attached to request.' });
      return;
    }

    const session = await getSession();
    if (!session?.email) {
      res.status(400).json({ error: 'No user email found in session.' });
      return;
    }

    const user = await db('user').where({ user_email: session.email }).first();

    if (!user) {
      res.status(404).json({ error: 'User not found in tenant database.' });
      return;
    }

    res.status(200).json({ user });
  } catch (err: any) {
    console.error('getCurrentUser error:', err);
    res.status(500).json({
      error: 'Failed to retrieve user',
      detail: err.message ?? String(err),
    });
  }
};
