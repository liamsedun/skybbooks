path = 'src/pages/sales/Quotes.tsx'
lines = open(path, encoding='utf-8').readlines()

for i, line in enumerate(lines):
    # Fix buildPayload to multiply totals by 100 (naira -> kobo)
    if '  const total = subtotal - discount + tax;' in line:
        lines[i] = '  const total = subtotal - discount + tax;\n'
        # Check next lines for the return statement
        print(f'Found total calc at line {i+1}')
    if '    subtotal,' in line and i > 75 and i < 110:
        lines[i] = '    subtotal: Math.round(subtotal * 100),\n'
        print(f'Fixed subtotal at line {i+1}')
    if '    discount,' in line and i > 75 and i < 110:
        lines[i] = '    discount: Math.round(discount * 100),\n'
        print(f'Fixed discount at line {i+1}')
    if '    tax,' in line and i > 75 and i < 110:
        lines[i] = '    tax: Math.round(tax * 100),\n'
        print(f'Fixed tax at line {i+1}')
    if '    total,' in line and i > 75 and i < 110:
        lines[i] = '    total: Math.round(total * 100),\n'
        print(f'Fixed total at line {i+1}')

open(path, 'w', encoding='utf-8').writelines(lines)
print('Done')

# Verify
lines2 = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines2[75:106], start=76):
    print(f'{i}: {l.rstrip()}')
