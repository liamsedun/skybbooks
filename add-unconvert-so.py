sales = open('src/routes/sales.ts', encoding='utf-8').read()

# Check if unconvert already exists
if '/unconvert' in sales:
    print('Unconvert routes already exist')
else:
    unconvert_routes = '''
// POST /api/sales/quotes/:id/unconvert — revert converted quote back to accepted
router.post('/quotes/:id/unconvert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [quote] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!quote) throw new AppError('Quote not found.', 404);
    if (quote.status !== 'converted') throw new AppError('Only converted quotes can be unconverted.', 400);
    const [updated] = await db.update(quotes)
      .set({ status: 'accepted', convertedToId: null })
      .where(eq(quotes.id, id))
      .returning();
    return res.status(200).json(updated);
  } catch (err) { return next(err); }
});

// POST /api/sales/sales-orders/:id/unconvert — revert fulfilled SO back to confirmed
router.post('/sales-orders/:id/unconvert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [so] = await db.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).limit(1);
    if (!so) throw new AppError('Sales order not found.', 404);
    if (so.status !== 'fulfilled') throw new AppError('Only fulfilled sales orders can be unconverted.', 400);
    const [updated] = await db.update(salesOrders)
      .set({ status: 'confirmed' })
      .where(eq(salesOrders.id, id))
      .returning();
    return res.status(200).json(updated);
  } catch (err) { return next(err); }
});

'''
    sales = sales.replace('export default router;', unconvert_routes + 'export default router;')
    open('src/routes/sales.ts', 'w', encoding='utf-8').write(sales)
    print('Added unconvert routes for Quotes and Sales Orders')

print('Done')
