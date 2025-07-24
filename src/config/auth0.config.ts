// src/config/auth0.config.ts

import { ManagementClient } from 'auth0';
import { getManagementApiToken } from '../services/auth0';
import dotenv from 'dotenv';

dotenv.config();

const domain = process.env.AUTH0_DOMAIN;

if (!domain) {
  throw new Error('[Auth0 Config] Missing AUTH0_DOMAIN environment variable.');
}

/**
 * Dynamically creates a new Auth0 ManagementClient using a valid access token.
 */
export async function createAuth0Client(): Promise<ManagementClient> {
  try {
    const token = await getManagementApiToken();

    if (!token) {
      console.error('[Auth0 Config] Management token was empty or undefined.');
      throw new Error('Missing token for Auth0 client');
    }

    console.log('[Auth0 Config] Successfully fetched management API token');

    return new ManagementClient({
      domain: domain!, // ✅ Safe to cast to string since we checked for existence
      token, // ✅ Correct usage — no `scope`
    });
  } catch (error: any) {
    console.error('[Auth0 Config] Failed to create Auth0 ManagementClient:', error.message);
    throw error;
  }
}