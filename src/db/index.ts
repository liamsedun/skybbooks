/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as tenantSchema from './tenant/tables';
import * as tenantRelations from './tenant/relations';
import * as platformSchema from './platform/tables';
import * as platformRelations from './platform/relations';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

export const db = drizzle(pool, {
  schema: {
    ...tenantSchema,
    ...tenantRelations,
    ...platformSchema,
    ...platformRelations,
  }
});

export type DrizzleDB = typeof db;
