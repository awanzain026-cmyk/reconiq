// Real bank/invoice exports format numbers and dates inconsistently --
// these helpers handle the common real-world variations, not just the
// one clean format our own sample data happens to use.

export function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  // Parenthesized amounts mean negative in accounting exports: (500.00) = -500
  const isNegative = /^\(.*\)$/.test(str) || str.startsWith("-");
  str = str.replace(/[()$,\s]/g, "").replace(/^-/, "");

  const value = parseFloat(str);
  if (isNaN(value)) return null;
  return isNegative ? -value : value;
}

export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str) return null;

  // MM/DD/YYYY or DD/MM/YYYY -- assume MM/DD/YYYY (US format) since that's
  // what our sample data and most US-facing exports use. A real production
  // system would let the user confirm this per-file since it's genuinely
  // ambiguous (01/02/2026 could be Jan 2 or Feb 1).
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Fallback: let JS Date try, then format as ISO date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function parsePaidStatus(raw: string | null | undefined): "paid" | "unpaid" {
  if (!raw) return "unpaid";
  const normalized = raw.trim().toLowerCase();
  return ["y", "yes", "paid", "true", "1"].includes(normalized) ? "paid" : "unpaid";
}
