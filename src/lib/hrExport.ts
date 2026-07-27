export function exportToCsv(headers: string[], rows: string[][], filename: string) {
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
    td{font-size:12px;color:#334155;}
    .total{font-weight:700;background:#f8fafc;}
    </style></head><body>
    <h1>${title}</h1>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); setTimeout(() => w.print(), 500); }
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

export function parseCsv(text: string): string[][] {
  return text.split('\n')
    .filter(line => line.trim())
    .map(line => {
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

export function downloadSampleCsv(headers: string[], filename: string) {
  const csv = [headers.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    inactive: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    draft: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
    overdue: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    open: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  };
  return map[status.toLowerCase()] || map.active;
}
