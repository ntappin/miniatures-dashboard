/**
 * A sheet tab used as a simple table: the first row names the columns,
 * each later row is one record. Columns are found by name, so they can be
 * reordered in the sheet, and rows missing a required field are skipped
 * (so notes typed below the table are ignored).
 */
export function rowsToRecords<C extends string>(
  rows: string[][],
  columns: readonly C[],
  required: readonly C[],
  tab: string,
): Record<C, string>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const idx = Object.fromEntries(
    columns.map((c) => [c, header.findIndex((h) => h.toString().trim().toLowerCase() === c.toLowerCase())]),
  ) as Record<C, number>;
  const missing = required.filter((c) => idx[c] < 0);
  if (missing.length) throw new Error(`The ${tab} tab needs ${missing.map((m) => `"${m}"`).join(" and ")} columns in its first row`);
  const get = (r: string[], c: C) => (idx[c] >= 0 ? (r[idx[c]] ?? "").toString().trim() : "");
  return body
    .filter((r) => required.every((c) => get(r, c)))
    .map((r) => Object.fromEntries(columns.map((c) => [c, get(r, c)])) as Record<C, string>);
}

export function recordsToRows<C extends string>(records: Partial<Record<C, string>>[], columns: readonly C[]): string[][] {
  return records.map((r) => columns.map((c) => r[c] ?? ""));
}
