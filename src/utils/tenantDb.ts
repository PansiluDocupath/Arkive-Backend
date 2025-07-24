// src/utils/tenantDb.ts

import knex, { Knex } from 'knex';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const {
  PG_HOST,
  PG_PORT,
  PG_USER,
  PG_PASSWORD,
  PG_MAIN_DB,
} = process.env;

if (!PG_HOST || !PG_USER || !PG_PASSWORD || !PG_MAIN_DB) {
  throw new Error('Missing PostgreSQL env variables');
}

const buildDbName = (orgId: string) => `arkive_${orgId}`;

const createTenantDb = async (orgId: string): Promise<Knex> => {
  const dbName = buildDbName(orgId);

  // Connect to main DB to check/create tenant DB
  const adminPool = new Pool({
    host: PG_HOST,
    port: parseInt(PG_PORT || '5432'),
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_MAIN_DB,
  });

  // Check if DB exists
  const dbExistsRes = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
  if (dbExistsRes.rowCount === 0) {
    console.log(`[TenantDB] Creating database: ${dbName}`);
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } else {
    console.log(`[TenantDB] Database exists: ${dbName}`);
  }

  await adminPool.end();

  // Connect to the tenant DB
  const tenantDb = knex({
    client: 'pg',
    connection: {
      host: PG_HOST,
      port: parseInt(PG_PORT || '5432'),
      user: PG_USER,
      password: PG_PASSWORD,
      database: dbName,
    },
  });

  // Enable uuid_generate_v4() if not already
  await tenantDb.raw(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Create tables if they don't exist

  const hasUser = await tenantDb.schema.hasTable('user');
  if (!hasUser) {
    await tenantDb.schema.createTable('user', (t) => {
      t.text('user_id').primary(); 
      t.text('user_name');
      t.text('user_email').unique().index();
    });
  }

  const hasPrompt = await tenantDb.schema.hasTable('prompt_template');
  if (!hasPrompt) {
    await tenantDb.schema.createTable('prompt_template', (t) => {
      t.uuid('prompt_id').primary().defaultTo(tenantDb.raw('uuid_generate_v4()'));
      t.text('prompt_name');
      t.text('prompt_content');
    });
  }

  const hasMcpData = await tenantDb.schema.hasTable('mcp_data');
  if (!hasMcpData) {
    await tenantDb.schema.createTable('mcp_data', (t) => {
      t.uuid('mcp_id').primary().defaultTo(tenantDb.raw('uuid_generate_v4()'));
      t.text('mcp_name');
      t.text('mcp_details');
      t.text('mcp_icon');
    });
  }

  const hasMcpConnection = await tenantDb.schema.hasTable('mcp_connection');
  if (!hasMcpConnection) {
    await tenantDb.schema.createTable('mcp_connection', (t) => {
      t.text('user_id').notNullable(); 
      t.uuid('mcp_id').notNullable();
      t.text('mcp_token');
      t.text('status');
      t.primary(['user_id', 'mcp_id']);
      t.foreign('user_id').references('user.user_id');
      t.foreign('mcp_id').references('mcp_data.mcp_id');
    });
  }

  const hasFile = await tenantDb.schema.hasTable('file_history');
  if (!hasFile) {
    await tenantDb.schema.createTable('file_history', (t) => {
      t.uuid('file_id').primary().defaultTo(tenantDb.raw('uuid_generate_v4()'));
      t.text('file_name');
      t.text('file_url');
      t.text('file_type');
      t.text('file_status');
      t.text('user_id').references('user.user_id'); 
    });
  }

  const hasChatCategory = await tenantDb.schema.hasTable('chat_category');
  if (!hasChatCategory) {
    await tenantDb.schema.createTable('chat_category', (t) => {
      t.uuid('chat_category_id').primary().defaultTo(tenantDb.raw('uuid_generate_v4()'));
      t.text('chat_category_name');
    });
  }

  const hasChat = await tenantDb.schema.hasTable('chat_history');
  if (!hasChat) {
    await tenantDb.schema.createTable('chat_history', (t) => {
      t.uuid('chat_id').primary().defaultTo(tenantDb.raw('uuid_generate_v4()'));
      t.uuid('chat_category_id').references('chat_category.chat_category_id');
      t.text('role');
      t.text('content');
    });
  }

  return tenantDb;
};

export { createTenantDb, buildDbName };