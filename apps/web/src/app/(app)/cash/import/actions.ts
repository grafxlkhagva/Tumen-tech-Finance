"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { actionError } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import {
  BANK_PARSERS,
  parseWorkbook,
  type BankFormat,
  type ParsedRow,
} from "@/lib/bank-import/parsers";

export type PreviewRow = {
  sourceRowNum: number;
  txnDate: string;
  txnTimestamp: string | null;
  direction: "income" | "expense";
  amount: number;
  description: string | null;
  partnerName: string | null;
  isOverlap: boolean;
};

export type ImportState =
  | {
      phase: "preview";
      bankAccountId: string;
      format: BankFormat;
      summary: {
        total: number;
        newCount: number;
        overlapCount: number;
        dateFrom: string | null;
        dateTo: string | null;
      };
      overlap: { has: boolean; latest: string | null };
      rows: PreviewRow[];
    }
  | { phase: "done"; inserted: number; skipped: number }
  | { error: string };

/** Гүйлгээний datetime-г харьцуулах key (ISO timestamp эсвэл огнооны эхлэл). */
function rowDateTime(r: ParsedRow): string {
  return r.txnTimestamp ?? `${r.txnDate}T00:00:00.000Z`;
}

export async function importBankStatement(
  _prev: ImportState | undefined,
  formData: FormData,
): Promise<ImportState> {
  try {
    const bankAccountId = String(formData.get("bank_account_id") || "");
    const confirmed = String(formData.get("confirmed") || "") === "1";
    const file = formData.get("file");

    if (!bankAccountId) return { error: "Банкаа сонгоно уу" };
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Файл сонгоно уу" };
    }

    const supabase = await createClient();
    const company = await getCurrentCompany(supabase);
    if (!company) return { error: "Компани олдсонгүй" };

    // Сонгосон банкны формат
    const { data: bank, error: bankErr } = await supabase
      .from("bank_accounts")
      .select("id, metadata")
      .eq("id", bankAccountId)
      .eq("company_id", company.companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (bankErr || !bank) return { error: "Банк олдсонгүй" };

    const format = (bank.metadata as Record<string, unknown> | null)?.import_format as
      | BankFormat
      | undefined;
    if (!format || !BANK_PARSERS[format]) {
      return { error: "Энэ банкны хуулга задлах формат тохируулагдаагүй байна" };
    }

    // Файлыг задлах
    const buf = await file.arrayBuffer();
    const { rows, errors } = parseWorkbook(buf, BANK_PARSERS[format]);
    if (errors.length > 0) return { error: errors.join("; ") };
    if (rows.length === 0) {
      return { error: "Файлаас гүйлгээ олдсонгүй. Формат/банк зөв эсэхээ шалгана уу." };
    }

    // Cutoff — энэ банкны хамгийн сүүлийн оруулсан гүйлгээ
    const { data: last } = await supabase
      .from("cash_transactions")
      .select("txn_date, txn_timestamp")
      .eq("bank_account_id", bankAccountId)
      .is("deleted_at", null)
      .order("txn_date", { ascending: false })
      .order("txn_timestamp", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const latest: string | null = last
      ? last.txn_timestamp ?? `${last.txn_date}T00:00:00.000Z`
      : null;

    const isOverlap = (r: ParsedRow) => latest !== null && rowDateTime(r) <= latest;
    const overlapCount = rows.filter(isOverlap).length;
    const newRows = rows.filter((r) => !isOverlap(r));

    // Огнооны муж
    const sorted = [...rows].sort((a, b) => a.txnDate.localeCompare(b.txnDate));
    const dateFrom = sorted[0]?.txnDate ?? null;
    const dateTo = sorted[sorted.length - 1]?.txnDate ?? null;

    // ── Preview үе ───────────────────────────────────────────────────
    if (!confirmed) {
      return {
        phase: "preview",
        bankAccountId,
        format,
        summary: {
          total: rows.length,
          newCount: newRows.length,
          overlapCount,
          dateFrom,
          dateTo,
        },
        overlap: { has: overlapCount > 0, latest },
        rows: rows.slice(0, 50).map((r) => ({
          sourceRowNum: r.sourceRowNum,
          txnDate: r.txnDate,
          txnTimestamp: r.txnTimestamp,
          direction: r.direction,
          amount: r.amount,
          description: r.description,
          partnerName: r.partnerName,
          isOverlap: isOverlap(r),
        })),
      };
    }

    // ── Commit үе — давхцсан мөрүүдийг алгасаж зөвхөн шинийг оруулна ──
    if (newRows.length === 0) {
      return { phase: "done", inserted: 0, skipped: rows.length };
    }

    const payload = newRows.map((r) => ({
      company_id: company.companyId,
      bank_account_id: bankAccountId,
      txn_date: r.txnDate,
      txn_timestamp: r.txnTimestamp,
      direction: r.direction,
      amount: r.amount,
      description: r.description,
      partner_name: r.partnerName,
      partner_acc: r.partnerAcc,
      reference: "", // UNIQUE-д null-аас зайлсхийх (NULL давхцлыг таньдаггүй)
      currency: "MNT",
      source_row_num: r.sourceRowNum,
      raw_data: r.rawData,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("cash_transactions")
      .upsert(payload, {
        onConflict: "bank_account_id,txn_date,amount,reference,description",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insErr) return { error: actionError(insErr).error ?? "Хадгалахад алдаа гарлаа" };

    const insertedCount = inserted?.length ?? 0;
    revalidatePath("/cash");
    return {
      phase: "done",
      inserted: insertedCount,
      skipped: rows.length - insertedCount,
    };
  } catch (e) {
    return { error: actionError(e).error ?? "Алдаа гарлаа" };
  }
}
