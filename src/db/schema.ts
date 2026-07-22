/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BACKWARD-COMPATIBLE RE-EXPORT HUB
 * ===================================
 * This file re-exports all enums, tables, and relations from the split
 * schema files under src/db/. All existing imports from '../db/schema'
 * continue to work without changes.
 */

export * from './enums';
export * from './platform/tables';
export * from './platform/relations';
export * from './tenant/tables';
export * from './tenant/relations';
export { db } from './index';
export type { DrizzleDB } from './index';
