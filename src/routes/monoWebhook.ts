/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mono Connect webhook receiver.
 *
 * Mounted in src/server/index.ts BEFORE express.json() so the raw body is
 * available for HMAC signature verification. This file uses express.raw()
 * inline so it bypasses the global JSON parser.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, bankAccounts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { syncFlutterwaveTransactions } from '../services/flutterwave.service';

const router = Router();

router.post(
  '/account-updated',
  // Consume raw body for signature verification before any global JSON parser
  // This route is mounted before express.json() in index.ts, but we still
  // use express.raw() for the specific content-type to be explicit.
  (req: Request, res: Response, next: any) => {
    // Only handle application/json
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Expected application/json' });
    }

    let rawBody = '';

    req.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString('utf-8');
    });

    req.on('end', async () => {
      try {
        const signature = req.headers['x-mono-webhook-signature'] as string;
        if (!signature) {
          return res.status(401).json({ error: 'Missing webhook signature header' });
        }

        const webhookSecret = process.env.MONO_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error('[MonoWebhook] MONO_WEBHOOK_SECRET is not configured');
          return res.status(500).json({ error: 'Webhook secret not configured on server' });
        }

        const expected = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');

        if (signature !== expected) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        // Safe to parse now
        const event = JSON.parse(rawBody);

        if (event.event === 'mono.events.account_updated') {
          const monoAccountId = event.data?.account?._id;
          const meta = event.data?.meta || {};
          const dataStatus: string = meta.data_status || 'UNAVAILABLE';
          const syncStatus: string = meta.sync_status || '';

          if (monoAccountId) {
            const [ba] = await db
              .select()
              .from(bankAccounts)
              .where(eq(bankAccounts.monoAccountId, monoAccountId))
              .limit(1);

            if (ba) {
              const updates: Record<string, any> = { lastSyncedAt: new Date() };

              if (syncStatus === 'REAUTHORISATION_REQUIRED') {
                updates.monoAccountStatus = 'reauth_required';
              } else if (dataStatus === 'AVAILABLE' || dataStatus === 'PARTIAL') {
                updates.monoAccountStatus = 'active';
              }

              await db.update(bankAccounts).set(updates).where(eq(bankAccounts.id, ba.id));

              // Trigger incremental sync if data is available
              const hasTransactions = dataStatus === 'AVAILABLE' ||
                (dataStatus === 'PARTIAL' && event.data.retrieved_data?.includes('transactions'));

              if (hasTransactions) {
                const lastSync = ba.lastSyncedAt || new Date(0);
                syncFlutterwaveTransactions(ba.id, lastSync).catch((err) => {
                  console.error(`[MonoWebhook] Incremental sync failed for account ${ba.id}:`, err.message);
                });
              }
            }
          }
        }

        res.status(200).json({ received: true });
      } catch (err: any) {
        console.error('[MonoWebhook] Error processing webhook:', err.message);
        res.status(400).json({ error: 'Invalid webhook payload' });
      }
    });
  },
);

export default router;
