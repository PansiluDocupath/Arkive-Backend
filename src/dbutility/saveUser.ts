// src/dbutility/saveUser.ts
import { Knex } from 'knex';

interface SaveUserParams {
  db: Knex;
  userId: string;
  userName?: string;
  userEmail?: string;
}

export const saveUserIfNotExists = async ({
  db,
  userId,
  userName,
  userEmail,
}: SaveUserParams): Promise<void> => {
  if (!userEmail) {
    console.warn('[TenantDB] Cannot save user: Missing email');
    return;
  }

  try {
    const existing = await db('user').where({ user_email: userEmail }).first();

    if (!existing) {
      await db('user').insert({
        user_id: userId,
        user_name: userName || null,
        user_email: userEmail,
      });
      console.log(`[TenantDB] New user inserted with email: ${userEmail}`);
    } else {
      await db('user')
        .where({ user_email: userEmail })
        .update({
          user_id: userId,
          user_name: userName || null,
        });
      console.log(`[TenantDB] Existing user updated with email: ${userEmail}`);
    }
  } catch (err) {
    console.error('[TenantDB] Error saving/updating user:', err);
    throw err;
  }
};