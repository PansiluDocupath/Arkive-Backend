// src/routes/auth/postRegister.ts

import express, { Request, Response } from 'express';
import jwt, { JwtHeader } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import axios from 'axios';

const router = express.Router();

const auth0Domain = process.env.AUTH0_DOMAIN!;
const mgmtClientId = process.env.AUTH0_CLIENT_ID!;
const mgmtClientSecret = process.env.AUTH0_CLIENT_SECRET!;

// Token type
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Get a management API token
const getManagementToken = async (): Promise<string> => {
  const res = await axios.post<TokenResponse>(
    `https://${auth0Domain}/oauth/token`,
    {
      grant_type: 'client_credentials',
      client_id: mgmtClientId,
      client_secret: mgmtClientSecret,
      audience: `https://${auth0Domain}/api/v2/`,
    }
  );
  return res.data.access_token;
};

// Setup JWKS client
const client = jwksClient({
  jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
});

// Get public key from JWKS
const getKey = (
  header: JwtHeader,
  callback: (err: Error | null, key?: string) => void
) => {
  client.getSigningKey(header.kid!, function (err, key) {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

// POST /api/auth/post-register
router.post('/post-register', async (req: Request, res: Response) => {
  try {
    const { authorization } = req.headers;
    const { organizationId } = req.body;

    if (!authorization) return res.status(401).send('Missing token');
    if (!organizationId) return res.status(400).send('Missing organizationId');

    const token = authorization.replace('Bearer ', '');

    const decoded: any = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {}, (err, decoded) => {
        if (err || !decoded) return reject(err);
        resolve(decoded);
      });
    });

    const userId = decoded.sub;
    const mgmtToken = await getManagementToken();

    // Assign user to selected organization
    await axios.post(
      `https://${auth0Domain}/api/v2/organizations/${organizationId}/members`,
      { members: [userId] },
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      }
    );

    // Update user's app_metadata with org ID and approval flag
    await axios.patch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        app_metadata: {
          organization_id: organizationId,
          approved: false,
        },
      },
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      }
    );

    console.log(`[POST-REGISTER] User ${userId} assigned to ${organizationId} and marked unapproved`);
    return res.sendStatus(200);

  } catch (err) {
    console.error('[POST-REGISTER ERROR]', err);
    return res.status(500).send('Failed to assign organization');
  }
});

export default router;