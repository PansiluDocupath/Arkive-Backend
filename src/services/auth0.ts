// src/services/auth0.ts

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const domain = process.env.AUTH0_DOMAIN;
const audience = `https://${domain}/api/v2/`; // Hardcoded for Management API
const clientId = process.env.AUTH0_CLIENT_ID;
const clientSecret = process.env.AUTH0_CLIENT_SECRET;

if (!domain || !audience || !clientId || !clientSecret) {
  throw new Error(
    '[Auth0 Service] Missing required env variables. Please set AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID, and AUTH0_MGMT_CLIENT_SECRET'
  );
}

/**
 * Fetches a Management API token using client credentials.
 */
export async function getManagementApiToken(): Promise<string> {
  try {
    const tokenUrl = `https://${domain}/oauth/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience,
        scope: 'read:users update:users create:users delete:users read:organizations update:organizations'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Auth0 Service] Token fetch failed (${response.status}): ${errorText}`);
      throw new Error('Failed to retrieve management API token');
    }

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
      console.error('[Auth0 Service] Token response missing access_token:', data);
      throw new Error('Invalid token response from Auth0');
    }

    console.log('🔐 Token:', data.access_token); // ✅ Log the token for debugging

    return data.access_token;
  } catch (err: any) {
    console.error('[Auth0 Service] Unexpected error while fetching token:', err.message);
    throw err;
  }
}