path = 'src/routes/sales.ts'
lines = open(path, encoding='utf-8').readlines()

for i, line in enumerate(lines):
    # Fix the convert endpoint line price calculation
    # Original: const price = Number(ql.unitPrice || 0);
    # Should multiply by 100 since unitPrice stored in naira in jsonb
    if 'const price = Number(ql.unitPrice || 0);' in line:
        lines[i] = '        const price = Math.round(Number(ql.unitPrice || 0) * 100); // stored in naira, convert to kobo\n'
        print(f'Fixed price conversion at line {i+1}')

open(path, 'w', encoding='utf-8').writelines(lines)
print('Done')

# Verify
for i, l in enumerate(lines):
    if 'unitPrice' in l and 'kobo' in l:
        print(f'Line {i+1}: {l.rstrip()}')
