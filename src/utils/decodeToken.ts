import jwt from 'jsonwebtoken';
import { updateSession, getSession } from './sessionStore';

interface DecodedIdToken {
  email?: string;
  nickname?: string;
  name?: string;
  [key: string]: any;
}

export const decodeIdToken = async (): Promise<void> => {
  try {
    const session = await getSession();
    if (!session?.id_token) {
      throw new Error('ID token not found in session');
    }

    const decoded = jwt.decode(session.id_token) as DecodedIdToken | null;
    if (!decoded || !decoded.email) {
      throw new Error('Email missing in decoded ID token');
    }

    await updateSession({
      email: decoded.email,
      nickname: decoded.nickname || decoded.name || ''
    });

  } catch (err) {
    console.error('Error decoding ID token:', err);
    throw new Error('Failed to decode and update session with ID token');
  }
};
