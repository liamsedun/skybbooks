import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  accounts,
  bills,
  contacts,
  vendorCredits,
  journalEntries
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, reverseJournalEntry } from './ledger.service';

async function resolveAccountsPayable(orgId: string, tx: any): Promise<string> {
  const [apAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%payable%'`
      )
    )
    .limit(1);

  if (apAccount) return apAccount.id;

  const [fallbackLiability] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'liability')))
    .limit(1);

  if (fallbackLiability) return fallbackLiability.id;

  throw new AppError(
    'Accounts Payable account not configured. Please create a liability account with Payable in its name.',
    400
  );
}

async function resolveExpenseAccount(orgId: string, tx: any): Promise<string> {
  const [expAccount] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'expense')))
    .limit(1);

  if (expAccount) return expAccount.id;

  throw new AppError('A valid Expense general ledger account is required.', 400);
}

export async function createVendorCredit(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;
    const subtotal = Number(input.subtotal || 0);
    const tax = Number(input.tax || 0);
    const total = subtotal + tax;

    if (total <= 0) {
      throw new AppError('Vendor credit total must be greater than zero.', 400);
    }

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(vendorCredits)
      .where(eq(vendorCredits.orgId, orgId));

    const vcCount = Number(countResult?.count || 0) + 1;
    const vcNumber = `VC-${String(vcCount).padStart(6, '0')}`;

    const [credit] = await tx
      .insert(vendorCredits)
      .values({
        orgId,
        vcNumber,
        vendorId: input.vendorId,
        billId: input.billId || null,
        date: new Date(input.date || new Date()),
        status: 'issued',
        subtotal,
        tax,
        total,
        remainingCredit: total,
        notes: input.notes || null,
        createdBy,
      })
      .returning();

    const apAccountId = await resolveAccountsPayable(orgId, tx);
    const expAccountId = await resolveExpenseAccount(orgId, tx);

    const journalLines: any[] = [];

    journalLines.push({
      accountId: apAccountId,
      debit: total,
      description: `AP reduction for vendor credit ${vcNumber}`,
    });

    journalLines.push({
      accountId: expAccountId,
      credit: total,
      description: `Purchase offset for vendor credit ${vcNumber}`,
    });

    const journalEntry = await createJournalEntry({
      orgId,
      date: credit.date,
      description: `Journal posting of Vendor Credit ${vcNumber}`,
      reference: vcNumber,
      source: 'manual',
      sourceId: credit.id,
      createdBy,
      lines: journalLines,
    }, tx);

    const [finalCredit] = await tx
      .update(vendorCredits)
      .set({ journalEntryId: journalEntry.id })
      .where(eq(vendorCredits.id, credit.id))
      .returning();

    return finalCredit;
  });
}

export async function updateVendorCredit(id: string, input: any, userId: string): Promise<any> {
  const [credit] = await db
    .select()
    .from(vendorCredits)
    .where(eq(vendorCredits.id, id))
    .limit(1);

  if (!credit) throw new AppError('Vendor credit not found.', 404);
  if (credit.status !== 'issued') throw new AppError('Only issued vendor credits can be edited.', 400);

  const updates: any = {};
  if (input.date !== undefined) updates.date = new Date(input.date);
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.subtotal !== undefined) {
    updates.subtotal = Number(input.subtotal);
    updates.total = updates.subtotal + (input.tax !== undefined ? Number(input.tax) : credit.tax);
    updates.remainingCredit = updates.total - (credit.total - credit.remainingCredit);
  }
  if (input.tax !== undefined) {
    updates.tax = Number(input.tax);
    updates.total = (input.subtotal !== undefined ? Number(input.subtotal) : credit.subtotal) + updates.tax;
    updates.remainingCredit = updates.total - (credit.total - credit.remainingCredit);
  }

  const [updated] = await db
    .update(vendorCredits)
    .set(updates)
    .where(eq(vendorCredits.id, id))
    .returning();

  return updated;
}

export async function applyVendorCredit(cnId: string, billId: string, amount: number, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [credit] = await tx
      .select()
      .from(vendorCredits)
      .where(eq(vendorCredits.id, cnId))
      .limit(1);

    if (!credit) throw new AppError('Vendor credit not found.', 404);
    if (credit.status === 'void') throw new AppError('Cannot apply a void vendor credit.', 400);
    if (credit.remainingCredit < amount) {
      throw new AppError(`Applied amount exceeds remaining credit balance.`, 400);
    }

    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (!bill) throw new AppError('Bill not found.', 404);
    if (bill.status === 'draft' || bill.status === 'void') {
      throw new AppError('Bill is not in an active open state to receive credits.', 400);
    }
    if (bill.balanceDue < amount) {
      throw new AppError(`Applied credit exceeds bill outstanding balance due.`, 400);
    }

    const nextAmountPaid = bill.amountPaid + amount;
    const nextBalanceDue = bill.total - nextAmountPaid;
    const nextBillStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';

    await tx
      .update(bills)
      .set({
        amountPaid: nextAmountPaid,
        balanceDue: nextBalanceDue,
        status: nextBillStatus,
      })
      .where(eq(bills.id, bill.id));

    const nextRemainingCredit = credit.remainingCredit - amount;
    const nextCnStatus = nextRemainingCredit <= 0 ? 'applied' : 'issued';

    await tx
      .update(vendorCredits)
      .set({
        remainingCredit: nextRemainingCredit,
        status: nextCnStatus,
      })
      .where(eq(vendorCredits.id, credit.id));

    const apAccountId = await resolveAccountsPayable(credit.orgId, tx);

    await createJournalEntry({
      orgId: credit.orgId,
      date: new Date(),
      description: `Offset application: Vendor Credit ${credit.vcNumber} to Bill ${bill.billNumber}`,
      reference: credit.vcNumber,
      source: 'manual',
      sourceId: credit.id,
      createdBy: userId,
      lines: [
        {
          accountId: apAccountId,
          debit: amount,
          description: `Credit application offset references ${credit.vcNumber}`,
        },
        {
          accountId: apAccountId,
          credit: amount,
          description: `Payable reduction offset references ${bill.billNumber}`,
        },
      ],
    }, tx);

    return {
      message: `Successfully applied vendor credit ${credit.vcNumber} to bill ${bill.billNumber}.`,
      appliedAmount: amount,
      remainingCredit: nextRemainingCredit,
      billBalanceDue: nextBalanceDue,
    };
  });
}

export async function voidVendorCredit(cnId: string, orgId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [credit] = await tx
      .select()
      .from(vendorCredits)
      .where(and(eq(vendorCredits.id, cnId), eq(vendorCredits.orgId, orgId)))
      .limit(1);

    if (!credit) throw new AppError('Vendor credit not found.', 404);
    if (credit.status === 'void') throw new AppError('This vendor credit is already void.', 400);
    if (credit.remainingCredit < credit.total) {
      throw new AppError('This vendor credit has already been partially or fully applied and cannot be voided directly.', 400);
    }

    if (credit.journalEntryId) {
      await reverseJournalEntry(credit.journalEntryId, new Date(), userId);
    }

    const [voided] = await tx
      .update(vendorCredits)
      .set({ status: 'void', remainingCredit: 0 })
      .where(eq(vendorCredits.id, cnId))
      .returning();

    return voided;
  });
}

export async function listVendorCredits(orgId: string): Promise<any[]> {
  const rows = await db
    .select({
      id: vendorCredits.id,
      orgId: vendorCredits.orgId,
      vcNumber: vendorCredits.vcNumber,
      vendorId: vendorCredits.vendorId,
      billId: vendorCredits.billId,
      date: vendorCredits.date,
      status: vendorCredits.status,
      subtotal: vendorCredits.subtotal,
      tax: vendorCredits.tax,
      total: vendorCredits.total,
      remainingCredit: vendorCredits.remainingCredit,
      notes: vendorCredits.notes,
      journalEntryId: vendorCredits.journalEntryId,
      createdBy: vendorCredits.createdBy,
      createdAt: vendorCredits.createdAt,
      vendorName: contacts.name,
      vendorEmail: contacts.email,
      billNumber: bills.billNumber,
    })
    .from(vendorCredits)
    .leftJoin(contacts, eq(vendorCredits.vendorId, contacts.id))
    .leftJoin(bills, eq(vendorCredits.billId, bills.id))
    .where(eq(vendorCredits.orgId, orgId))
    .orderBy(sql`${vendorCredits.createdAt} desc`);

  return rows.map(r => ({
    ...r,
    vendor: r.vendorName ? { name: r.vendorName, email: r.vendorEmail } : undefined,
    billNumber: r.billNumber || undefined,
    vendorName: undefined,
    vendorEmail: undefined,
  }));
}

export async function getVendorCredit(id: string, orgId: string): Promise<any> {
  const [credit] = await db
    .select()
    .from(vendorCredits)
    .where(and(eq(vendorCredits.id, id), eq(vendorCredits.orgId, orgId)))
    .limit(1);

  if (!credit) throw new AppError('Vendor credit not found.', 404);
  return credit;
}
