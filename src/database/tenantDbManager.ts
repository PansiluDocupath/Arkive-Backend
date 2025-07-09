import knex, { Knex } from 'knex';
import { getEnv } from '../utils/env';

const baseConfig = {
  client: 'pg',
  connection: {
    host: getEnv('PG_HOST'),
    port: parseInt(getEnv('PG_PORT'), 10),
    user: getEnv('PG_USER'),
    password: getEnv('PG_PASSWORD'),
    database: 'postgres',
  },
};

const dbCache: Map<string, Knex> = new Map();

const getRootKnex = (): Knex => knex(baseConfig);

export const getOrCreateTenantDb = async (orgId: string): Promise<Knex> => {
  const dbName = `arkive_${orgId.replace(/-/g, '_')}`;

  if (dbCache.has(dbName)) {
    return dbCache.get(dbName)!;
  }

  const root = getRootKnex();
  const exists = await databaseExists(root, dbName);

  if (!exists) {
    await createDatabase(root, dbName);
  }

  const tenantKnex = createTenantKnex(dbName);
  await initializeTables(tenantKnex);

  dbCache.set(dbName, tenantKnex);
  return tenantKnex;
};

const databaseExists = async (rootKnex: Knex, dbName: string): Promise<boolean> => {
  const result = await rootKnex
    .select('datname')
    .from('pg_database')
    .where({ datname: dbName })
    .first();
  return !!result;
};

const createDatabase = async (rootKnex: Knex, dbName: string): Promise<void> => {
  await rootKnex.raw(`CREATE DATABASE "${dbName}"`);
  console.log(`Created new tenant database: ${dbName}`);
};

const createTenantKnex = (dbName: string): Knex =>
  knex({
    client: 'pg',
    connection: {
      host: getEnv('PG_HOST'),
      port: parseInt(getEnv('PG_PORT'), 10),
      user: getEnv('PG_USER'),
      password: getEnv('PG_PASSWORD'),
      database: dbName,
    },
    pool: { min: 0, max: 10 },
  });

const initializeTables = async (db: Knex): Promise<void> => {
  // Ensure uuid-ossp extension is enabled for UUID generation
  await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  const hasUser = await db.schema.hasTable('user');
  if (!hasUser) {
    await db.schema.createTable('user', (t) => {
      t.uuid('user_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.text('user_name');
      t.text('user_email').unique().index();
    });
  }

  const hasPrompt = await db.schema.hasTable('prompt_template');
  if (!hasPrompt) {
    await db.schema.createTable('prompt_template', (t) => {
      t.uuid('prompt_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.text('prompt_name');
      t.text('prompt_content');
    });
  }

  const hasMcpData = await db.schema.hasTable('mcp_data');
  if (!hasMcpData) {
    await db.schema.createTable('mcp_data', (t) => {
      t.uuid('mcp_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.text('mcp_name');
      t.text('mcp_details');
      t.text('mcp_icon');
    });
  }

  const hasMcpConnection = await db.schema.hasTable('mcp_connection');
  if (!hasMcpConnection) {
    await db.schema.createTable('mcp_connection', (t) => {
      t.uuid('user_id').notNullable();
      t.uuid('mcp_id').notNullable();
      t.text('mcp_token');
      t.text('status');
      t.primary(['user_id', 'mcp_id']);
      t.foreign('user_id').references('user.user_id');
      t.foreign('mcp_id').references('mcp_data.mcp_id');
    });
  }

  const hasFile = await db.schema.hasTable('file_history');
  if (!hasFile) {
    await db.schema.createTable('file_history', (t) => {
      t.uuid('file_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.text('file_name');
      t.text('file_url');
      t.text('file_type');
      t.text('file_status');
      t.uuid('user_id').references('user.user_id');
    });
  }

  const hasChatCategory = await db.schema.hasTable('chat_category');
  if (!hasChatCategory) {
    await db.schema.createTable('chat_category', (t) => {
      t.uuid('chat_category_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.text('chat_category_name');
    });
  }

  const hasChat = await db.schema.hasTable('chat_history');
  if (!hasChat) {
    await db.schema.createTable('chat_history', (t) => {
      t.uuid('chat_id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      t.uuid('chat_category_id').references('chat_category.chat_category_id');
      t.text('role');
      t.text('content');
    });
  }

  console.log('Tables initialized (if not already)');
};
