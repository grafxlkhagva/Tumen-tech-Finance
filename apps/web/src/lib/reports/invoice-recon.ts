/**
 * Invoice ↔ Bank reconciliation — shared logic for /recon/invoices.
 *
 * Port of legacy/app.py:invoice_bank_recon. The page calls
 * `fn_invoice_bank_recon(company_id, month?)` and post-processes the result
 * here so the same status / variance / KPI math is reproducible by tests +
 * any future Excel export.
 */

export type ReconStatus = "match" | "inv_more" | "bank_more";

export type ReconRpcRow = {
  partner_id: string;
  partner_name: string;
  partner_register: string | null;
  total_inv: number;
  paid_inv: number;
  cnt_inv: number;
  total_bank: number;
  cnt_bank: number;
  matched: number;
};

export type ReconRow = ReconRpcRow & {
  diff: number;       // total_bank - total_inv (positive = bank illuu)
  status: ReconStatus;
  /** matched / total_inv * 100, capped at 100. NaN-safe. */
  matchPct: number;
};

export type ReconFilters = {
  status: ReconStatus | "";
  partnerId: string;  // "" = all
  month: number | ""; // 1-12 or ""
};

export type ReconSummary = {
  cnt: { total: number; match: number; inv_more: number; bank_more: number };
  amt: {
    inv:       number; // Σ total_inv across ALL rows (unfiltered)
    bank:      number; // Σ total_bank
    matched:   number; // Σ matched
    inv_more:  number; // Σ |diff| where status=inv_more (нэхэмжлэл дутуу = bank deficit)
    bank_more: number; // Σ  diff  where status=bank_more (банк илүү)
  };
  /** matched / inv * 100 — overall collection completeness */
  reconPct: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Param parsing
// ────────────────────────────────────────────────────────────────────────────

const VALID_STATUS = new Set<ReconStatus>(["match", "inv_more", "bank_more"]);

export function parseReconFilters(sp: {
  status?: string;
  partner_id?: string;
  month?: string;
}): ReconFilters {
  const status = (sp.status && VALID_STATUS.has(sp.status as ReconStatus)
    ? (sp.status as ReconStatus)
    : "") as ReconStatus | "";
  // partner_id is a UUID — trust caller to validate format; Supabase rejects invalid
  const partnerId = (sp.partner_id ?? "").trim().slice(0, 64);
  const m = Number(sp.month);
  const month = m >= 1 && m <= 12 ? m : "";
  return { status, partnerId, month };
}

// ────────────────────────────────────────────────────────────────────────────
// Enrichment & filtering
// ────────────────────────────────────────────────────────────────────────────

const EPSILON = 1; // within ±1 төгрөг = "matched"

export function enrichReconRows(raw: ReconRpcRow[]): ReconRow[] {
  return raw
    .map<ReconRow>((r) => {
      const diff = Number(r.total_bank) - Number(r.total_inv);
      const status: ReconStatus =
        Math.abs(diff) < EPSILON ? "match" : diff > 0 ? "bank_more" : "inv_more";
      const matchPct =
        Number(r.total_inv) > 0
          ? Math.min(100, (Number(r.matched) / Number(r.total_inv)) * 100)
          : 0;
      return { ...r, diff, status, matchPct };
    })
    // Largest absolute discrepancy first — surfaces the most urgent rows
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

export function filterRecon(rows: ReconRow[], f: ReconFilters): ReconRow[] {
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.partnerId && r.partner_id !== f.partnerId) return false;
    return true;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregates — computed BEFORE the status filter so chip counts always show
// the full population (matches legacy semantics).
// ────────────────────────────────────────────────────────────────────────────

export function buildReconSummary(rows: ReconRow[]): ReconSummary {
  let inv = 0, bank = 0, matched = 0;
  let invMore = 0, bankMore = 0;
  let cMatch = 0, cInvMore = 0, cBankMore = 0;

  for (const r of rows) {
    inv     += Number(r.total_inv)  || 0;
    bank    += Number(r.total_bank) || 0;
    matched += Number(r.matched)    || 0;
    if (r.status === "match")          cMatch++;
    else if (r.status === "inv_more") {
      cInvMore++;
      invMore += Math.abs(r.diff);
    } else /* bank_more */ {
      cBankMore++;
      bankMore += r.diff;
    }
  }

  return {
    cnt: { total: rows.length, match: cMatch, inv_more: cInvMore, bank_more: cBankMore },
    amt: { inv, bank, matched, inv_more: invMore, bank_more: bankMore },
    reconPct: inv > 0 ? Math.min(100, (matched / inv) * 100) : 0,
  };
}
