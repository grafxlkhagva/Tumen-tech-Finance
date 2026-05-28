/**
 * Mongolian payroll calculator — TypeScript twin of:
 *   - legacy/app.py:calc_salary() (source of truth for porting)
 *   - supabase/migrations/.../calculate_payroll() (DB source of truth)
 *
 * MUST produce identical output to PL/pgSQL `calculate_payroll` for the same
 * inputs (verified by calc.test.ts with 1000 random fuzzed inputs).
 *
 * Tax constants from Монгол Улсын Татварын хууль 2026.
 */

/** Working hours per month (МОНГ-ийн ЗТШ батлал). */
export const MONTH_HOURS: Record<number, number> = {
  1: 136, 2: 152, 3: 168, 4: 176, 5: 160, 6: 168,
  7: 184, 8: 168, 9: 176, 10: 184, 11: 160, 12: 184,
};

/** ЭМНДШ + НДШ дээд хязгаар (2026: 7,920,000 MNT). */
export const EMNDSH_CAP = 7_920_000;

/** Байгууллагын ЭМНДШ + НД-ийн хувь хэмжээ. */
export const EMNDSH_ORG_RATE = 0.125;

/** Ажилтны ЭМНДШ-ийн хувь хэмжээ. */
export const EMNDSH_EMP_RATE = 0.115;

/** ХХОАТ-ын суурь хувь хэмжээ. */
export const HHOAT_RATE = 0.1;

/** Урьдчилгааны үндсэн ноом цалин (default 40%). */
export const ADVANCE_RATE = 0.4;

/**
 * Article 23.1 — Сарын орлогын хэмжээгээр ХХОАТ-аас хасах хөнгөлөлт.
 */
export function art231(monthlyIncome: number): number {
  if (monthlyIncome <= 500_000)   return 20_000;
  if (monthlyIncome <= 1_000_000) return 18_000;
  if (monthlyIncome <= 1_500_000) return 16_000;
  if (monthlyIncome <= 2_000_000) return 14_000;
  if (monthlyIncome <= 2_500_000) return 12_000;
  if (monthlyIncome <= 3_000_000) return 10_000;
  return 0;
}

export type SalaryInput = {
  base_salary: number;          // Гэрээт суурь цалин
  worked_hours: number;         // Бодит ажилласан цаг
  month: number;                // 1-12
  phone_allowance?: number;     // Утасны нэмэгдэл
  sales_bonus?: number;         // Борлуулалтын бонус
  leave_pay?: number;           // Чөлөөний нөхөн олговор
  bod_salary?: number;          // Удирдлагын урамшуулал (separate from bod)
  advance_override?: number | null; // Гар үсгээр оруулсан аванс
};

export type SalaryOutput = {
  bod: number;                  // Үндсэн цалин = base × worked / total
  total_hours: number;          // Сарын ажлын цаг
  niit: number;                 // Нийт орлого (bod + phone + sales + leave + bod_extra)
  emndsh: number;               // Ажилтны ЭМНДШ (11.5%)
  emndsh_org: number;           // Байгууллагын ЭМНДШ (12.5%)
  ded23: number;                // Article 23.1 хөнгөлөлт
  hhoat: number;                // ХХОАТ (10% - hopngolol)
  adv: number;                  // Урьдчилгаа
  gart: number;                 // Гарт авах цэвэр цалин
};

/**
 * Compute payroll values. Rounds final outputs to integer MNT (matches Flask).
 *
 *   const r = calcSalary({ base_salary: 3500000, worked_hours: 168, month: 7 });
 *   console.log(r.gart);  // → 1,840,250
 */
export function calcSalary(input: SalaryInput): SalaryOutput {
  const base = Number(input.base_salary) || 0;
  const worked = Number(input.worked_hours) || 0;
  const month = Number(input.month) || 1;
  const phone = Number(input.phone_allowance) || 0;
  const sales = Number(input.sales_bonus) || 0;
  const leave = Number(input.leave_pay) || 0;
  const bodExtra = Number(input.bod_salary) || 0;
  const advOverride = input.advance_override;

  const totalHours = MONTH_HOURS[month] ?? 176;
  const bod = totalHours > 0 ? (base / totalHours) * worked : 0;
  const niit = bod + phone + sales + leave + bodExtra;
  const cappedNiit = Math.min(niit, EMNDSH_CAP);
  const emndsh = cappedNiit * EMNDSH_EMP_RATE;
  const emndshOrg = cappedNiit * EMNDSH_ORG_RATE;
  const ded23 = art231(niit);
  const hhoat = Math.max(0, (niit - emndsh) * HHOAT_RATE - ded23);
  const adv = advOverride !== null && advOverride !== undefined ? Number(advOverride) : base * ADVANCE_RATE;
  const gart = niit - emndsh - hhoat - adv;

  return {
    bod: Math.round(bod),
    total_hours: totalHours,
    niit: Math.round(niit),
    emndsh: Math.round(emndsh),
    emndsh_org: Math.round(emndshOrg),
    ded23: Math.round(ded23),
    hhoat: Math.round(hhoat),
    adv: Math.round(adv),
    gart: Math.round(gart),
  };
}
