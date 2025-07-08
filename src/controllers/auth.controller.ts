import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { RegisterSchema, LoginSchema } from '../validators/auth.schema';
import { z } from 'zod';
import { getEnv } from '../utils/env';

let mgmtToken: string | null = null;
let tokenExpiry: number | null = null;

const getMgmtToken = async (): Promise<string> => {
  const now = Date.now();
  if (mgmtToken && tokenExpiry && now < tokenExpiry) return mgmtToken;

  const domain = getEnv('AUTH0_DOMAIN');
  const clientId = getEnv('AUTH0_MGMT_CLIENT_ID');
  const clientSecret = getEnv('AUTH0_MGMT_CLIENT_SECRET');

  try {
    const res = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch token: ${errorText}`);
    }

    const data = await res.json() as { access_token?: string; expires_in?: number };

    if (!data.access_token || !data.expires_in) {
      throw new Error(`Invalid token response: ${JSON.stringify(data)}`);
    }

    mgmtToken = data.access_token;
    tokenExpiry = now + data.expires_in * 1000 - 60000; // buffer 1 minute
    return mgmtToken;
  } catch (err) {
    console.error('getMgmtToken error:', err);
    throw err;
  }
};

const getUserOrganizationId = async (email: string): Promise<string> => {
  const domain = getEnv('AUTH0_DOMAIN');
  const token = await getMgmtToken();

  const userRes = await fetch(`https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!userRes.ok) {
    const errorText = await userRes.text();
    throw new Error(`Failed to fetch user by email: ${errorText}`);
  }

  const users = await userRes.json() as { user_id: string }[];
  const user = users[0];

  if (!user?.user_id) {
    throw new Error('User not found');
  }

  const orgRes = await fetch(`https://${domain}/api/v2/users/${user.user_id}/organizations`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!orgRes.ok) {
    const errorText = await orgRes.text();
    throw new Error(`Failed to fetch user organizations: ${errorText}`);
  }

  const orgs = await orgRes.json() as { id: string }[];

  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error('User is not yet approved by an organization');
  }

  return orgs[0].id;
};

// POST /api/auth/register
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = RegisterSchema.parse(req.body);
    const domain = getEnv('AUTH0_DOMAIN');
    const token = await getMgmtToken();

    const userRes = await fetch(`https://${domain}/api/v2/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connection: 'Username-Password-Authentication',
        email: body.email,
        password: body.password,
        username: body.username,
        email_verified: false,
        app_metadata: { approved: false }
      })
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      res.status(400).json({ error: 'User creation failed', detail: errorText });
      return;
    }

    const user = await userRes.json() as { user_id?: string };

    if (!user.user_id) {
      res.status(400).json({ error: 'User creation failed', detail: user });
      return;
    }

    const orgRes = await fetch(`https://${domain}/api/v2/organizations/${body.organizationId}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        members: [user.user_id]
      })
    });

    if (!orgRes.ok) {
      const errorText = await orgRes.text();
      res.status(400).json({ error: 'Failed to add user to organization', detail: errorText });
      return;
    }

    res.status(201).json({ message: 'Registration complete. Awaiting approval.' });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ errors: err.errors });
    } else {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed', detail: err.message });
    }
  }
};

// POST /api/auth/login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = LoginSchema.parse(req.body);

    const domain = getEnv('AUTH0_DOMAIN');
    const clientId = getEnv('AUTH0_CLIENT_ID');
    const clientSecret = getEnv('AUTH0_CLIENT_SECRET');

    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: body.email,
        password: body.password,
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        scope: 'openid profile email',
        realm: 'Username-Password-Authentication'
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      res.status(401).json({ error: 'Login failed', detail: errorText });
      return;
    }

    const data = await tokenRes.json() as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      res.status(401).json({ error: data.error_description });
      return;
    }

    if (!data.access_token || !data.id_token) {
      res.status(500).json({ error: 'Incomplete token response from Auth0' });
      return;
    }

    // Step 1: Save token to session
    try {
      const { updateSession } = await import('../utils/sessionStore');
      await updateSession({
        access_token: data.access_token,
        id_token: data.id_token,
        expires_in: data.expires_in,
        token_type: data.token_type
      });

      // Step 2: Decode and store email/nickname from token
      const { decodeIdToken } = await import('../utils/decodeToken');
      await decodeIdToken();

      // Step 3: Fetch and store organization ID
      const { fetchAndStoreOrgId } = await import('../utils/fetchOrgId');
      await fetchAndStoreOrgId();

    } catch (e) {
      console.error('Session init error:', e);
      if (e instanceof Error) {
        res.status(500).json({ error: 'Login session setup failed', detail: e.message });
      } else {
        res.status(500).json({ error: 'Login session setup failed', detail: String(e) });
      }
      return;
    }

    // ✅ Login complete
    res.status(200).json({
      access_token: data.access_token,
      id_token: data.id_token,
      expires_in: data.expires_in,
      token_type: data.token_type
    });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ errors: err.errors });
    } else {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed', detail: err.message });
    }
  }
};


// GET /api/auth/organizations
export const getOrganizations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const token = await getMgmtToken();
    const domain = getEnv('AUTH0_DOMAIN');

    const orgRes = await fetch(`https://${domain}/api/v2/organizations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!orgRes.ok) {
      const errorText = await orgRes.text();
      res.status(500).json({ error: 'Failed to fetch organizations', detail: errorText });
      return;
    }

    const orgs = await orgRes.json() as { id: string; name: string; display_name?: string }[];

    if (!Array.isArray(orgs)) {
      res.status(500).json({ error: 'Unexpected response from Auth0' });
      return;
    }

    const filtered = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      display_name: org.display_name
    }));

    res.status(200).json(filtered);
  } catch (err: any) {
    console.error('Fetch orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations', detail: err.message });
  }
};
