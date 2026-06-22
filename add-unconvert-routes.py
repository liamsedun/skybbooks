"""
Appends unconvert endpoints for quotes and sales orders to src/routes/sales.ts
before 'export default router;'
"""

ROUTES = '''
// =========================================================================
// UNCONVERT ENDPOINTS
// =========================================================================

// POST /api/sales/quotes/:id/unconvert
router.post('/quotes/:id/unconvert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [quote] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!quote) throw new AppError('Quote not found.', 404);
    if (quote.status !== 'converted') throw new AppError('Quote is not converted.', 400);

    // If the linked invoice is still a draft, void it
    if (quote.convertedToId) {
      const [inv] = await db.select().from(invoices)
        .where(and(eq(invoices.id, quote.convertedToId), eq(invoices.orgId, orgId))).limit(1);
      if (inv && inv.status === 'draft') {
        await db.update(invoices).set({ status: 'void' }).where(eq(invoices.id, quote.convertedToId));
      }
    }

    const [updated] = await db.update(quotes)
      .set({ status: 'accepted', convertedToId: null })
      .where(eq(quotes.id, id)).returning();
    return res.status(200).json(updated);
  } catch (err) { return next(err); }
});

// POST /api/sales/sales-orders/:id/unconvert
router.post('/sales-orders/:id/unconvert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [so] = await db.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).limit(1);
    if (!so) throw new AppError('Sales order not found.', 404);
    if (so.status !== 'fulfilled') throw new AppError('Sales order is not fulfilled.', 400);

    // Find and void the linked draft invoice if it exists
    const [linkedInv] = await db.select().from(invoices)
      .where(and(eq(invoices.soId, id), eq(invoices.orgId, orgId))).limit(1);
    if (linkedInv && linkedInv.status === 'draft') {
      await db.update(invoices).set({ status: 'void', soId: null }).where(eq(invoices.id, linkedInv.id));
    }

    const [updated] = await db.update(salesOrders)
      .set({ status: 'confirmed' })
      .where(eq(salesOrders.id, id)).returning();
    return res.status(200).json(updated);
  } catch (err) { return next(err); }
});

'''

with open("src/routes/sales.ts", "r", encoding="utf-8") as f:
    content = f.read()

MARKER = "export default router;"
if MARKER not in content:
    print("ERROR: marker not found"); exit(1)

content = content.replace(MARKER, ROUTES + MARKER, 1)

with open("src/routes/sales.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done — unconvert routes appended.")
