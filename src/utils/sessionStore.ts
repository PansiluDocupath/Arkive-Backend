import fs from 'fs/promises';
import path from 'path';

const SESSION_PATH = path.resolve(__dirname, '../../.auth_session.json');

export interface SessionData {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  [key: string]: any;
}

export const saveSession = async (data: SessionData): Promise<void> => {
  try {
    await fs.writeFile(SESSION_PATH, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
  } catch (err) {
    console.error('Error saving session:', err);
    throw new Error('Failed to save session');
  }
};

export const updateSession = async (updates: Partial<SessionData>): Promise<void> => {
  try {
    const current = await getSession() || {};
    const updated = { ...current, ...updates };
    await fs.writeFile(SESSION_PATH, JSON.stringify(updated, null, 2), { encoding: 'utf-8' });
  } catch (err) {
    console.error('Error updating session:', err);
    throw new Error('Failed to update session');
  }
};

export const getSession = async (): Promise<SessionData | null> => {
  try {
    await fs.access(SESSION_PATH);
    const content = await fs.readFile(SESSION_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    console.error('Error reading session:', err);
    throw new Error('Failed to read session');
  }
};

export const clearSession = async (): Promise<void> => {
  try {
    await fs.unlink(SESSION_PATH);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Error clearing session:', err);
      throw new Error('Failed to clear session');
    }
    // If ENOENT, do nothing — file doesn't exist
  }
};
