/** Unified export utilities — merges csvTemplates.ts + hrExport.ts patterns */

function bom(text: string): Blob {
  return new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
}

export function exportToCsv(headers: string[], rows: string[][], filename: string, options?: { noBom?: boolean }) {
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = options?.noBom ? new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }) : bom(csvContent);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate(headers: string[], filename: string) {
  const csv = headers.join(',');
  const blob = bom(csv);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(text: string): string[][] {
  return text.split('\n').filter(line => line.trim()).map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  });
}

export function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = e.target.files?.[0];
    if (!file) return reject(new Error('No file selected'));
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target?.result as string || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
    e.target.value = '';
  });
}

export function exportToPdf(title: string, headers: string[], rows: string[][], filename: string) {
  const tableRows = rows.map(r => `<tr>${r.map(c => `<td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:12px;color:#334155;">${c}</td>`).join('')}</tr>`).join('\n');
  const html = `
    <html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#1e293b;}
    h1{font-size:20px;margin-bottom:4px;}
    p{font-size:13px;color:#64748b;margin-bottom:24px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f1f5f9;padding:8px 12px;border:1px solid #e2e8f0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;text-align:left;}
    </style></head><body>
    <h1>${title}</h1>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); setTimeout(() => w.print(), 500); }
}

export function printWindow(title: string, headers: string[], rows: string[][]) {
  exportToPdf(title, headers, rows, 'print');
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
