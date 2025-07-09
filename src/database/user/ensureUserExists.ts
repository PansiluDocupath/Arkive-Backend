// src/database/user/ensureUserExists.ts
import { Knex } from 'knex';
import { getSession } from '../../utils/sessionStore';

export const ensureUserExists = async (db: Knex): Promise<void> => {
  const session = await getSession();
  const { email, nickname } = session || {};

  if (!email || !nickname) {
    throw new Error('Missing user info from session');
  }

  const existingUser = await db('user').where({ user_email: email }).first();

  if (!existingUser) {
    await db('user').insert({
      user_name: nickname,
      user_email: email
    });
    console.log(`New user inserted for ${email}`);
  } else {
    console.log(`User already exists for ${email}`);
  }
};
