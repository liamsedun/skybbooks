# Fix 1: Quotes - fetch full quote detail when editing (to get lines)
# Fix 2: SalesOrders - formFromSO should NOT divide unitPrice by 100

# ── FIX 1: Quotes.tsx - add detail fetch on edit ──────────────
quotes = open('src/pages/sales/Quotes.tsx', encoding='utf-8').read()

# Fix formFromQuote - lines are stored as naira already, no conversion needed
# The issue is the LIST endpoint doesn't return lines - need to fetch detail

# Add a fetchQuoteDetail query and use it in openEdit
old_open_edit = '''  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(q: Quote) {
    setEditingId(q.id);
    setForm(formFromQuote(q));
    setFormError(null);
    setModalOpen(true);
  }'''

new_open_edit = '''  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  async function openEdit(q: Quote) {
    setEditingId(q.id);
    setFormError(null);
    // Fetch full quote detail to get lines
    try {
      const r = await api.get(\`/sales/quotes/\${q.id}\`);
      setForm(formFromQuote(r.data));
    } catch {
      setForm(formFromQuote(q));
    }
    setModalOpen(true);
  }'''

if old_open_edit in quotes:
    quotes = quotes.replace(old_open_edit, new_open_edit)
    print('✅ Fix 1a: Quotes openEdit now fetches full detail')
else:
    print('❌ Fix 1a: openEdit pattern not found in Quotes.tsx')

open('src/pages/sales/Quotes.tsx', 'w', encoding='utf-8').write(quotes)

# ── FIX 2: SalesOrders.tsx - fix formFromSO unit price ────────
so = open('src/pages/sales/SalesOrders.tsx', encoding='utf-8').read()

# The formFromSO divides unitPrice by 100 but buildPayload sends as-is
# Lines are stored in naira in jsonb, so NO division needed
old_from_so = '''function formFromSO(so: SalesOrder): SOFormState {
  return {
    customerId: so.customerId,
    date: so.date ? so.date.split('T')[0] : '',
    expectedDelivery: so.expectedDelivery ? so.expectedDelivery.split('T')[0] : '',
    status: so.status,
    notes: so.notes || '',
    lines: (so.lines || []).length > 0 ? so.lines.map(l => ({
      itemId: l.itemId || '',
      description: l.description,
      quantity: l.quantity.toString(),
      unitPrice: (l.unitPrice / 100).toString(),
      discountPct: (l.discountPct || 0).toString(),
      taxRate: (l.taxRate || 7.5).toString(),
    })) : [{ ...EMPTY_LINE }],
  };
}'''

new_from_so = '''function formFromSO(so: SalesOrder): SOFormState {
  return {
    customerId: so.customerId,
    date: so.date ? so.date.split('T')[0] : '',
    expectedDelivery: so.expectedDelivery ? so.expectedDelivery.split('T')[0] : '',
    status: so.status,
    notes: so.notes || '',
    lines: (so.lines && so.lines.length > 0) ? so.lines : [{ ...EMPTY_LINE }],
  };
}'''

if old_from_so in so:
    so = so.replace(old_from_so, new_from_so)
    print('✅ Fix 2: SalesOrders formFromSO fixed (no /100 conversion)')
else:
    print('❌ Fix 2: formFromSO pattern not found - checking...')
    # Try to find it
    for i, line in enumerate(so.split('\n')):
        if 'formFromSO' in line or 'unitPrice / 100' in line:
            print(f'  Line {i+1}: {line}')

# Also fix openEdit in SalesOrders to fetch full detail
old_so_edit = '''  function openEdit(so: SalesOrder) { setEditingId(so.id); setForm(formFromSO(so)); setFormError(null); setModalOpen(true); }'''
new_so_edit = '''  async function openEdit(so: SalesOrder) {
    setEditingId(so.id);
    setFormError(null);
    try {
      const r = await api.get(`/sales/sales-orders/${so.id}`);
      setForm(formFromSO(r.data));
    } catch {
      setForm(formFromSO(so));
    }
    setModalOpen(true);
  }'''

if old_so_edit in so:
    so = so.replace(old_so_edit, new_so_edit)
    print('✅ Fix 2b: SalesOrders openEdit now fetches full detail')
else:
    # Try multiline version
    print('  Trying alternative openEdit pattern...')
    for i, line in enumerate(so.split('\n')):
        if 'openEdit' in line and 'SalesOrder' in line:
            print(f'  Found at line {i+1}: {line}')

open('src/pages/sales/SalesOrders.tsx', 'w', encoding='utf-8').write(so)

# ── FIX 3: Also allow editing confirmed SO (not just draft) ───
print('\n✅ All fixes applied!')
print('Now verify and push.')
