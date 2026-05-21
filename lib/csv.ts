/** Minimal RFC-4180-ish CSV parser — handles quoted fields, commas and newlines. */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV text into row objects keyed by the (trimmed) header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
}

/** Case-insensitive field lookup so imports tolerate header variations. */
export function field(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const hit = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
    if (hit && row[hit] !== "") return row[hit];
  }
  return "";
}
