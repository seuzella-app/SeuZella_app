/**
 * CSV / Formula Injection Sanitizer
 * Previne que células exportadas em CSV sejam interpretadas como comandos/fórmulas
 * em clientes de planilha (Excel, Google Sheets, LibreOffice Calc).
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitiza uma célula de texto individual para exportação CSV segura
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Se começar com caracteres de disparo de fórmula, prefixa com apóstrofo (')
  if (FORMULA_TRIGGERS.some((trigger) => str.startsWith(trigger))) {
    return `'${str}`;
  }

  return str;
}

/**
 * Converte matriz de objetos em conteúdo CSV sanitizado
 */
export function exportToSafeCsv<T extends Record<string, any>>(
  rows: T[],
  headers?: { key: keyof T; label: string }[]
): string {
  if (rows.length === 0) return '';

  const columns = headers || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const headerRow = columns.map((col) => `"${sanitizeCsvCell(col.label).replace(/"/g, '""')}"`).join(',');

  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = sanitizeCsvCell(row[col.key]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}
