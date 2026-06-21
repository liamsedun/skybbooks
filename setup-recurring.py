import re

# ── STEP 1: Add routes to sales.ts ────────────────────────────
sales = open('src/routes/sales.ts', encoding='utf-8').read()

if '/recurring-invoices' in sales:
    print('✅ Step 1: Recurring invoice routes already exist')
else:
    new_routes = '''
// =========================================================================
// RECURRING INVOICES ENDPOINTS
// =========================================================================

const createRecurringSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  template: z.object({
    lines: z.array(z.any()),
    notes: z.string().optional(),
    terms: z.string().optional(),
    paymentTerms: z.number().default(30),
  }).optional(),
});

const updateRecurringSchema = createRecurringSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /api/sales/recurring-invoices
router.get('/recurring-invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db.select().from(recurringInvoices)
      .where(eq(recurringInvoices.orgId, orgId))
      .orderBy(desc(recurringInvoices.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

// GET /api/sales/recurring-invoices/:id
router.get('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [rec] = await db.select().from(recurringInvoices)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId))).limit(1);
    if (!rec) throw new AppError('Recurring invoice not found.', 404);
    return res.status(200).json(rec);
  } catch (err) { return next(err); }
});

// POST /api/sales/recurring-invoices
router.post('/recurring-invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = createRecurringSchema.parse(req.body);
    const startDate = new Date(body.startDate);
    const [rec] = await db.insert(recurringInvoices).values({
      orgId,
      customerId: body.customerId,
      frequency: body.frequency,
      startDate,
      endDate: body.endDate ? new Date(body.endDate) : null,
      nextRunDate: startDate,
      isActive: true,
      template: body.template || null,
      createdBy: userId,
    }).returning();
    return res.status(201).json(rec);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// PATCH /api/sales/recurring-invoices/:id
router.patch('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateRecurringSchema.parse(req.body);
    const updateData: any = { ...body };
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    const [rec] = await db.update(recurringInvoices).set(updateData)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId))).returning();
    if (!rec) throw new AppError('Recurring invoice not found.', 404);
    return res.status(200).json(rec);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// DELETE /api/sales/recurring-invoices/:id
router.delete('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [existing] = await db.select().from(recurringInvoices)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId))).limit(1);
    if (!existing) throw new AppError('Recurring invoice not found.', 404);
    await db.delete(recurringInvoices).where(eq(recurringInvoices.id, id));
    return res.status(200).json({ message: 'Billing template deleted.' });
  } catch (err) { return next(err); }
});

// POST /api/sales/recurring-invoices/:id/generate — generate invoice now
router.post('/recurring-invoices/:id/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;
    const [rec] = await db.select().from(recurringInvoices)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId))).limit(1);
    if (!rec) throw new AppError('Recurring invoice template not found.', 404);

    const tmpl = (rec as any).template || {};
    const lines = tmpl.lines || [];
    const paymentTermsDays = tmpl.paymentTerms || 30;

    // Calculate totals from lines
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    for (const l of lines) {
      const qty = Number(l.quantity || 1);
      const price = Number(l.unitPrice || 0);
      const discPct = Number(l.discountPct || 0);
      const taxRate = Number(l.taxRate ?? 7.5);
      const base = qty * price;
      const disc = Math.round(base * discPct / 100);
      const afterDisc = base - disc;
      const tax = Math.round(afterDisc * taxRate / 100);
      subtotal += base;
      discountAmount += disc;
      taxAmount += tax;
    }
    const total = subtotal - discountAmount + taxAmount;

    // Generate invoice number
    const count = await db.select({ c: sql\`count(*)\` }).from(invoices).where(eq(invoices.orgId, orgId));
    const seq = (Number((count[0] as any).c) + 1).toString().padStart(4, '0');
    const invoiceNumber = \`INV-\${seq}\`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    const [invoice] = await db.insert(invoices).values({
      orgId, invoiceNumber,
      customerId: rec.customerId,
      recurringId: rec.id,
      date: new Date(),
      dueDate,
      status: 'draft',
      currency: 'NGN',
      subtotal,
      discountAmount,
      taxAmount,
      total,
      amountPaid: 0,
      balanceDue: total,
      notes: tmpl.notes || null,
      terms: tmpl.terms || null,
      createdBy: userId,
    }).returning();

    // Insert invoice lines
    for (const l of lines) {
      const qty = Number(l.quantity || 1);
      const price = Math.round(Number(l.unitPrice || 0) * 100);
      const discPct = Number(l.discountPct || 0);
      const taxRate = Number(l.taxRate ?? 7.5);
      const base = qty * price;
      const disc = Math.round(base * discPct / 100);
      const afterDisc = base - disc;
      const taxAmt = Math.round(afterDisc * taxRate / 100);
      await db.insert(invoiceLines).values({
        invoiceId: invoice.id,
        itemId: l.itemId || null,
        description: l.description || '',
        quantity: qty.toString(),
        unitPrice: price,
        discountPct: discPct.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmt,
        lineTotal: afterDisc + taxAmt,
        accountId: null,
      });
    }

    // Update nextRunDate
    const freqDays: Record<string, number> = {
      daily: 1, weekly: 7, monthly: 30, quarterly: 90, annually: 365
    };
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + (freqDays[rec.frequency] || 30));
    await db.update(recurringInvoices)
      .set({ nextRunDate: nextRun })
      .where(eq(recurringInvoices.id, id));

    return res.status(201).json({ ...invoice, invoiceNumber });
  } catch (err) { return next(err); }
});

'''
    sales = sales.replace('export default router;', new_routes + 'export default router;')
    open('src/routes/sales.ts', 'w', encoding='utf-8').write(sales)
    print('✅ Step 1: Recurring invoice routes added')

# ── STEP 2: Add recurringInvoices to import ───────────────────
sales_lines = open('src/routes/sales.ts', encoding='utf-8').readlines()
for i, line in enumerate(sales_lines):
    if 'import { db, contacts, invoices' in line and 'recurringInvoices' not in line:
        sales_lines[i] = line.replace(
            'import { db, contacts, invoices',
            'import { db, contacts, invoices, recurringInvoices'
        )
        open('src/routes/sales.ts', 'w', encoding='utf-8').writelines(sales_lines)
        print(f'✅ Step 2: recurringInvoices added to import at line {i+1}')
        break
else:
    print('✅ Step 2: recurringInvoices already in import')

# ── STEP 3: Replace placeholder in ModulePlaceholders.tsx ─────
mp = open('src/pages/ModulePlaceholders.tsx', encoding='utf-8').read()

if "export { RecurringInvoicesPage } from './sales/RecurringInvoices'" in mp:
    print('✅ Step 3: RecurringInvoicesPage already exported from real file')
else:
    mp_lines = mp.split('\n')
    start = None
    end = None
    for i, line in enumerate(mp_lines):
        if 'export function RecurringInvoicesPage()' in line and start is None:
            start = i
        if start is not None and i > start and line.strip() == '}':
            end = i
            break

    if start is not None and end is not None:
        new_export = "export { RecurringInvoicesPage } from './sales/RecurringInvoices';"
        mp_lines = mp_lines[:start] + [new_export] + mp_lines[end+1:]
        open('src/pages/ModulePlaceholders.tsx', 'w', encoding='utf-8').write('\n'.join(mp_lines))
        print(f'✅ Step 3: Replaced placeholder (lines {start+1}-{end+1}) with real export')
    else:
        print(f'❌ Step 3 FAILED: start={start}, end={end}')

# ── STEP 4: Update App.tsx import ────────────────────────────
app = open('src/App.tsx', encoding='utf-8').read()
if 'RecurringInvoices' in app and 'sales/RecurringInvoices' not in app:
    print('✅ Step 4: App.tsx gets RecurringInvoicesPage from ModulePlaceholders (already wired)')
else:
    print('✅ Step 4: App.tsx already correct')

print('\n✅ All done! Now copy RecurringInvoices.tsx to src/pages/sales/ and push.')
