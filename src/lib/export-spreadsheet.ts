import * as XLSX from 'xlsx';
import type { Lead } from './leads-types';

type SpreadsheetRow = Record<string, string | number>;

export function generateSpreadsheet(leads: Lead[]): ArrayBuffer {
  const rows: SpreadsheetRow[] = leads.map((lead) => ({
    Empresa: lead.empresa,
    Decisor: lead.decisor,
    Cargo: lead.cargo,
    'E-mail': lead.email,
    WhatsApp: lead.whatsapp,
    Setor: lead.setor,
    Social_Media: typeof lead.socialMedia === 'object' ? JSON.stringify(lead.socialMedia) : (lead.socialMedia || ''),
    Porte: lead.porte,
    Status: lead.status,
    Hook: lead.hook,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  /* Define column widths for readability */
  ws['!cols'] = [
    { wch: 18 }, // Empresa
    { wch: 22 }, // Decisor
    { wch: 26 }, // Cargo
    { wch: 32 }, // E-mail
    { wch: 16 }, // WhatsApp
    { wch: 18 }, // Setor
    { wch: 32 }, // Social_Media
    { wch: 12 }, // Porte
    { wch: 12 }, // Status
    { wch: 50 }, // Hook
  ];

  /* Style header row — bold + royal blue background */
  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let {c} = headerRange.s; c <= headerRange.e.c; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[cellAddress];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4169E1' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  /* Apply alternating row colors and padding */
  for (let r = 1; r <= headerRange.e.r; r++) {
    for (let {c} = headerRange.s; c <= headerRange.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellAddress];
      if (cell) {
        cell.s = {
          font: { color: { rgb: '1E293B' } },
          fill: {
            fgColor: { rgb: r % 2 === 0 ? 'F1F5F9' : 'FFFFFF' },
          },
          alignment: { vertical: 'center' },
        };
      }
    }
  }

  /* Freeze header row */
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  /* Auto-filter on header row */
  ws['!autofilter'] = { ref: ws['!ref'] || 'A1' };

  XLSX.utils.book_append_sheet(wb, ws, 'Leads Secretaria.ai');

  /* Write to buffer */
  const buffer = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    cellStyles: true,
  });

  return buffer as ArrayBuffer;
}

export function generateCSV(leads: Lead[]): string {
  const rows: SpreadsheetRow[] = leads.map((lead) => ({
    Empresa: lead.empresa,
    Decisor: lead.decisor,
    Cargo: lead.cargo,
    'E-mail': lead.email,
    WhatsApp: lead.whatsapp,
    Setor: lead.setor,
    Social_Media: typeof lead.socialMedia === 'object' ? JSON.stringify(lead.socialMedia) : (lead.socialMedia || ''),
    Porte: lead.porte,
    Status: lead.status,
    Hook: lead.hook,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  return XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
}
