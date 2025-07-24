import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback, JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import dotenv from 'dotenv';

dotenv.config();

// === Auth0 Config ===
const auth0Domain = process.env.AUTH0_DOMAIN;
const audience = process.env.AUTH0_AUDIENCE;

if (!auth0Domain || !audience) {
  throw new Error('Missing required Auth0 environment variables: AUTH0_DOMAIN or AUTH0_AUDIENCE');
}

// === ✅ JWKS Client Setup ===
const client = jwksClient({
  jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

// === ✅ Key Resolver ===
function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (!header.kid) {
    console.error('[verifyToken] Missing "kid" in token header');
    return callback(new Error('Missing "kid" in token header'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('[verifyToken] Failed to get signing key:', err);
      return callback(err);
    }

    try {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    } catch (keyErr) {
      console.error('[verifyToken] Error extracting public key:', keyErr);
      callback(keyErr as Error);
    }
  });
}

// === ✅ Middleware ===
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[verifyToken] Missing or malformed Authorization header');
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    getKey,
    {
      audience,
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        console.error('[verifyToken] Token verification failed:', err);
        return res.status(403).json({ error: 'Invalid token' });
      }

      const sub = (decoded as JwtPayload)?.sub;

      if (!sub) {
        console.warn('[verifyToken] Token is valid but missing "sub"');
        return res.status(400).json({ error: 'Token missing sub' });
      }

      (req as any).user = { sub };
      console.log('[verifyToken] Token verified successfully. User sub:', sub);
      next();
    }
  );
};