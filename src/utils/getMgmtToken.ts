import { getEnv } from './env';
import fetch from 'node-fetch';

export const getMgmtApiToken = async (): Promise<string> => {
  const domain = getEnv('AUTH0_DOMAIN');
  const clientId = getEnv('AUTH0_CLIENT_ID');
  const clientSecret = getEnv('AUTH0_CLIENT_SECRET');

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
    const error = await res.text();
    throw new Error(`Failed to get management token: ${error}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
};
