import { getSession, updateSession } from './sessionStore';
import { getEnv } from './env';
import fetch from 'node-fetch';
import { getMgmtApiToken } from './getMgmtToken'; 

type Auth0User = {
  user_id: string;
  email: string;
};

type Auth0Org = {
  id: string;
  name: string;
};

export const fetchAndStoreOrgId = async (): Promise<void> => {
  try {
    const session = await getSession();

    if (!session || !session.email) {
      throw new Error('No session or email found. Make sure the user is logged in.');
    }

    const domain = getEnv('AUTH0_DOMAIN');
    const token = await getMgmtApiToken();

    //Get user by email
    const userRes = await fetch(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(session.email)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!userRes.ok) {
      const detail = await userRes.text();
      throw new Error(`Failed to fetch user: ${userRes.status} - ${detail}`);
    }

    const users = (await userRes.json()) as Auth0User[];
    const user = users?.[0];

    if (!user || !user.user_id) {
      throw new Error('User not found or missing user_id');
    }

    //Get user's organizations
    const orgRes = await fetch(
      `https://${domain}/api/v2/users/${user.user_id}/organizations`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!orgRes.ok) {
      const detail = await orgRes.text();
      throw new Error(`Failed to fetch organizations: ${orgRes.status} - ${detail}`);
    }

    const orgs = (await orgRes.json()) as Auth0Org[];

    if (!Array.isArray(orgs) || orgs.length === 0) {
      throw new Error('User is not part of any organization.');
    }

    const orgId = orgs[0].id;
    await updateSession({ organization_id: orgId }); // save to session

  } catch (err) {
    console.error('Error in fetchAndStoreOrgId:', err);
    throw new Error('Failed to fetch and store organization ID');
  }
};
