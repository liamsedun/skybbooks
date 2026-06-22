import re

path = 'src/components/sales/RecordPaymentDrawer.tsx'
content = open(path, encoding='utf-8').read()

# Fix 1: Remove handleAllocatedAmountChange function (no longer needed)
# Fix 2: Update handleCheckboxToggle to auto-distribute from payment amount
# Fix 3: Replace the per-invoice amount input with just balance due display
# Fix 4: Auto-distribute payment amount across checked invoices proportionally

# Replace the allocation row UI - remove the amount input, show balance due only
old_allocation_row = '''                          {/* Right: cash override input */}
                          <div className="text-right shrink-0 relative max-w-[120px]">
                            <span className="text-[10px] font-mono text-emerald-600 absolute left-2 top-2">₦</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={field.allocatedAmount ? (field.allocatedAmount / 100).toFixed(2) : ''}
                              onChange={(e) => handleAllocatedAmountChange(index, e.target.value)}
                              className="w-full pl-5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:bg-white focus:border-purple-600 outline-none text-xs transition"
                            />
                          </div>'''

new_allocation_row = '''                          {/* Right: allocated amount display */}
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400 font-mono uppercase mb-0.5">Allocated</p>
                            <p className="font-extrabold text-emerald-700 font-mono text-sm">
                              {field.selected && field.allocatedAmount > 0 ? formatNaira(field.allocatedAmount) : <span className="text-slate-300">—</span>}
                            </p>
                          </div>'''

if old_allocation_row in content:
    content = content.replace(old_allocation_row, new_allocation_row)
    print('✅ Fix 1: Removed per-invoice amount input, showing allocated display')
else:
    print('❌ Fix 1: Could not find allocation row pattern')

# Fix 2: Update handleCheckboxToggle to auto-distribute Amount Received across checked invoices
old_checkbox = '''  // Handle allocation checkbox toggle
'''

# Find and show the full handleCheckboxToggle function
start = content.find('// Handle allocation checkbox toggle')
end = content.find('\n  // Handle allocated amount manual override')
if start > 0 and end > 0:
    old_toggle_block = content[start:end]
    print(f'Found toggle block ({len(old_toggle_block)} chars)')
    
    new_toggle_block = '''// Handle allocation checkbox toggle
  const handleCheckboxToggle = (index: number) => {
    const current = watchedAllocations[index];
    const newSelected = !current.selected;
    setValue(`allocations.${index}.selected`, newSelected);
    
    // After toggling, re-distribute the payment amount across all checked invoices
    const updatedAllocations = [...watchedAllocations];
    updatedAllocations[index] = { ...updatedAllocations[index], selected: newSelected };
    
    const paymentKobo = Math.round((parseFloat(watchedAmount as any) || 0) * 100);
    const checkedInvoices = updatedAllocations.filter(f => f.selected);
    
    if (checkedInvoices.length === 0 || paymentKobo === 0) {
      // Clear all allocations
      updatedAllocations.forEach((_, i) => {
        setValue(`allocations.${i}.allocatedAmount`, 0);
      });
      return;
    }
    
    // Distribute payment amount: fill each invoice up to its balance due, in order
    let remaining = paymentKobo;
    updatedAllocations.forEach((alloc, i) => {
      if (!alloc.selected) {
        setValue(`allocations.${i}.allocatedAmount`, 0);
      } else {
        const canTake = Math.min(remaining, alloc.balanceDue);
        setValue(`allocations.${i}.allocatedAmount`, canTake);
        remaining -= canTake;
      }
    });
  };

  // When amount changes, re-distribute across checked invoices
  const handleAmountChange = (val: string) => {
    const paymentKobo = Math.round((parseFloat(val) || 0) * 100);
    const checkedInvoices = watchedAllocations.filter(f => f.selected);
    if (checkedInvoices.length === 0) return;
    
    let remaining = paymentKobo;
    watchedAllocations.forEach((alloc, i) => {
      if (!alloc.selected) return;
      const canTake = Math.min(remaining, alloc.balanceDue);
      setValue(`allocations.${i}.allocatedAmount`, canTake);
      remaining -= canTake;
    });
  };

'''
    content = content.replace(old_toggle_block, new_toggle_block)
    print('✅ Fix 2: Updated handleCheckboxToggle to auto-distribute')
else:
    print(f'❌ Fix 2: toggle start={start}, end={end}')

# Fix 3: Remove handleAllocatedAmountChange function
old_manual = '  // Handle allocated amount manual override\n  const handleAllocatedAmountChange = (index: number, val: string) => {'
if old_manual in content:
    # Find and remove the whole function
    manual_start = content.find('  // Handle allocated amount manual override')
    # Find end of this function (next const/function at same indent level)
    manual_end = content.find('\n  // Re-sum', manual_start)
    if manual_end < 0:
        manual_end = content.find('\n\n  const isAmountMismatched', manual_start)
    if manual_end < 0:
        manual_end = content.find('\n\n  const paymentAmountKobo', manual_start)
    if manual_start > 0 and manual_end > 0:
        old_manual_block = content[manual_start:manual_end]
        content = content.replace(old_manual_block, '')
        print('✅ Fix 3: Removed handleAllocatedAmountChange function')
    else:
        print(f'❌ Fix 3: Could not find end of handleAllocatedAmountChange (end={manual_end})')
else:
    print('⚠️  Fix 3: handleAllocatedAmountChange not found (may already be removed)')

# Fix 4: Wire the amount input onChange to handleAmountChange
old_amount_input = '''                    {...register('amount', {
                      required: 'Payment amount is required.',
                      min: { value: 0.01, message: 'Amount must be greater than zero.' },
                    })}
                    className="w-full pl-8 pr-4 py-2 border border-purple-300 rounded-xl font-extrabold text-slate-800 bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition text-base"'''

new_amount_input = '''                    {...register('amount', {
                      required: 'Payment amount is required.',
                      min: { value: 0.01, message: 'Amount must be greater than zero.' },
                      onChange: (e) => handleAmountChange(e.target.value),
                    })}
                    className="w-full pl-8 pr-4 py-2 border border-purple-300 rounded-xl font-extrabold text-slate-800 bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition text-base"'''

if old_amount_input in content:
    content = content.replace(old_amount_input, new_amount_input)
    print('✅ Fix 4: Wired amount onChange to handleAmountChange')
else:
    print('❌ Fix 4: amount input pattern not found')

# Fix 5: Update the allocation summary to show cleaner message
old_summary = '''                <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500 font-mono">
                  <span>Allocated: {formatNaira(totalAllocatedKobo)}</span>
                  <span className={unallocatedKobo > 0 ? 'text-purple-600 font-bold' : ''}>
                    Unallocated Excess: {formatNaira(unallocatedKobo)}
                  </span>
                </div>'''

new_summary = '''                <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500 font-mono">
                  <span>Allocated: <span className="font-bold text-emerald-600">{formatNaira(totalAllocatedKobo)}</span></span>
                  {unallocatedKobo > 0 && (
                    <span className="text-amber-600 font-bold">
                      Unallocated: {formatNaira(unallocatedKobo)} — check more invoices below
                    </span>
                  )}
                  {unallocatedKobo === 0 && totalAllocatedKobo > 0 && (
                    <span className="text-emerald-600 font-bold">✓ Fully allocated</span>
                  )}
                </div>'''

if old_summary in content:
    content = content.replace(old_summary, new_summary)
    print('✅ Fix 5: Updated allocation summary display')
else:
    print('❌ Fix 5: summary pattern not found')

open(path, 'w', encoding='utf-8').write(content)
print('\nDone! Now verify and push.')
