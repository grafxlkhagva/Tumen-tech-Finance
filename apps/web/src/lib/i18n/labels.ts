/**
 * Mongolian-default labels & enum mappings.
 * Ported from legacy/translations.py + extended for new schema enums.
 *
 * Use cases:
 *   import { t, ACCOUNT_TYPE, JOURNAL_STATUS } from "@/lib/i18n/labels";
 *   <span>{t("nav_journals")}</span>
 *   <Badge>{ACCOUNT_TYPE[a.type]}</Badge>
 */

// ---------------------------------------------------------------------------
// Generic UI labels (port of legacy/translations.py)
// ---------------------------------------------------------------------------
export const LABELS_MN = {
  // Sidebar sections
  nav_main: "Үндсэн",
  nav_home: "Нүүр хуудас",
  nav_records: "Бүртгэл",
  nav_accounts: "Дансны жагсаалт",
  nav_journals: "Гүйлгээний бүртгэл",
  nav_reports: "Тайлан",
  nav_report_list: "Тайлангийн жагсаалт",
  nav_balance_sheet: "Санхүү байдлын тайлан",
  nav_income: "Орлогын дэлгэрэнгүй тайлан",
  nav_cashflow: "Мөнгөн гүйлгээний тайлан",
  nav_equity: "Өмчийн өөрчлөлтийн тайлан",
  nav_cit: "ААНОАТ тайлан",
  nav_trial_balance: "Гүйлгээ баланс",
  nav_ledger: "Дансны хөдөлгөөн",
  nav_fixed_assets: "Үндсэн хөрөнгө",
  nav_hr: "Хүний нөөц",
  nav_salary: "Цалингийн бүртгэл",
  nav_ar_ap: "Авлага / Өглөг",
  nav_partners: "Харилцагчид",
  nav_receivables: "Авлага",
  nav_invoices: "Нэхэмжлэхийн тайлан",
  nav_payables: "Өглөг",
  nav_cash_section: "Мөнгөн хөрөнгө",
  nav_bank: "Банкны хуулга",
  nav_cash_summary: "Нэгтгэл",
  nav_bank_summary: "Банкны нэгтгэл",
  nav_tax: "Татвар",
  nav_vat: "НӨАТ бүртгэл",
  nav_barimt_recon: "Баримт тулгалт",
  nav_inv_recon: "Нэхэмж–Банк тулгалт",
  nav_forms_section: "Маягт",
  nav_forms: "Анхан шатны маягт",

  // Topbar / common
  hide_nums: "Тоог нуух",
  show_nums: "Тоог харуулах",
  add_invoice: "Нэхэмжлэх нэмэх",
  print: "Хэвлэх",
  add: "Нэмэх",
  edit: "Засах",
  delete: "Устгах",
  save: "Хадгалах",
  cancel: "Цуцлах",
  search: "Хайх",
  all: "Бүгд",
  total: "Нийт",
  date: "Огноо",
  amount: "Дүн",
  description: "Тайлбар",
  status: "Төлөв",
  back: "Буцах",
  close: "Хаах",
  partner: "Харилцагч",
  month: "Сар",
  year: "Жил",
  no_data: "Мэдээлэл байхгүй",
  loading: "Уншиж байна...",
  saving: "Хадгалж байна...",
  confirm_delete: "Устгахыг батлах уу?",
  required: "Заавал бөглөнө",
  new: "Шинэ",

  // Journal
  jnl_number: "Дугаар",
  jnl_entries: "Мөрийн тоо",
  jnl_posted: "Баталгаажсан",
  jnl_draft: "Ноорог",
  jnl_post: "Батлах",
  jnl_reverse: "Буцаах",
  jnl_unbalanced: "Дебит-Кредит тэнцүү биш",
  jnl_add_line: "Мөр нэмэх",
  jnl_remove_line: "Хасах",

  // Account
  acc_list_title: "Дансны жагсаалт",
  acc_code: "Код",
  acc_name: "Нэр",
  acc_type: "Төрөл",
  acc_balance: "Үлдэгдэл",
  acc_postable: "Бичигдэх",
  acc_parent: "Эцэг данс",

  // Invoice / AR
  inv_list_title: "Нэхэмжлэхийн тайлан",
  inv_total_billed: "Нийт нэхэмжилсэн",
  inv_collected: "Цугласан",
  inv_remaining: "Үлдэгдэл авлага",
  inv_collect_pct: "Цуглуулалтын хувь",
  inv_open: "Нээлттэй",
  inv_partial: "Хэсэгчлэн",
  inv_paid: "Төлөгдсөн",
  inv_overdue: "Хэтэрсэн",
  inv_no: "Нэхэмж №",
  inv_due: "Хугацаа",
  inv_paid_amt: "Төлсөн",
  inv_remaining_amt: "Үлдэгдэл",
  inv_list_header: "Нэхэмжлэхийн жагсаалт",
  inv_monthly: "Сарын нэгтгэл",
  inv_empty: "Нэхэмжлэл байхгүй байна",

  // Salary
  sal_employee: "Ажилтан",
  sal_gross: "Нийт цалин",
  sal_net: "Цэвэр цалин",
  sal_tax: "ХХОАТ",
  sal_social: "НД",
  sal_health: "ЭМД",
  sal_advance: "Урьдчилгаа",
  sal_bonus: "Урамшуулал",
} as const;

export type LabelKey = keyof typeof LABELS_MN;

/** Translation accessor — Mongolian-only for now, returns key on miss. */
export function t(key: LabelKey | string): string {
  return (LABELS_MN as Record<string, string>)[key] ?? key;
}

// ---------------------------------------------------------------------------
// Database enum → Mongolian display labels
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPE = {
  asset: "Хөрөнгө",
  liability: "Өр төлбөр",
  equity: "Эзний өмч",
  income: "Орлого",
  expense: "Зардал",
} as const;
export type AccountType = keyof typeof ACCOUNT_TYPE;

export const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  asset:     "bg-blue-100 text-blue-700",
  liability: "bg-orange-100 text-orange-700",
  equity:    "bg-purple-100 text-purple-700",
  income:    "bg-green-100 text-green-700",
  expense:   "bg-red-100 text-red-700",
};

export const JOURNAL_STATUS = {
  draft:    "Ноорог",
  posted:   "Баталгаажсан",
  reversed: "Буцаасан",
} as const;
export type JournalStatus = keyof typeof JOURNAL_STATUS;

export const JOURNAL_STATUS_COLOR: Record<JournalStatus, string> = {
  draft:    "bg-slate-200 text-slate-700",
  posted:   "bg-green-100 text-green-700",
  reversed: "bg-red-100 text-red-700",
};

export const JOURNAL_SOURCE = {
  manual:       "Гар",
  cash_import:  "Кассын import",
  vat:          "НӨАТ",
  ebarimt:      "eBarimt",
  payroll:      "Цалин",
  depreciation: "Элэгдэл",
  opening:      "Нээлт",
  closing:      "Хаалт",
  reversal:     "Буцаалт",
  import:       "Импорт",
} as const;
export type JournalSource = keyof typeof JOURNAL_SOURCE;

export const PARTNER_TYPE = {
  customer: "Захиалагч",
  supplier: "Нийлүүлэгч",
  both:     "Холимог",
  employee: "Ажилтан",
  other:    "Бусад",
} as const;
export type PartnerType = keyof typeof PARTNER_TYPE;

export const AR_AP_STATUS = {
  draft:       "Ноорог",
  open:        "Нээлттэй",
  partial:     "Хэсэгчлэн",
  paid:        "Төлөгдсөн",
  overdue:     "Хэтэрсэн",
  cancelled:   "Цуцалсан",
  written_off: "Хорогдсон",
} as const;
export type ArApStatus = keyof typeof AR_AP_STATUS;

export const AR_AP_STATUS_COLOR: Record<ArApStatus, string> = {
  draft:       "bg-slate-200 text-slate-700",
  open:        "bg-blue-100 text-blue-700",
  partial:     "bg-yellow-100 text-yellow-800",
  paid:        "bg-green-100 text-green-700",
  overdue:     "bg-red-100 text-red-700",
  cancelled:   "bg-slate-100 text-slate-500",
  written_off: "bg-gray-100 text-gray-600",
};

export const VAT_DIRECTION = {
  inbound:  "Орох (Худалдан авалт)",
  outbound: "Гарах (Борлуулалт)",
} as const;
export type VatDirection = keyof typeof VAT_DIRECTION;

export const VAT_TAX_TYPE = {
  standard: "Энгийн (10%)",
  zero:     "0% (экспорт)",
  reduced:  "Бууруулсан (1%)",
  exempt:   "Чөлөөлөгдсөн",
} as const;
export type VatTaxType = keyof typeof VAT_TAX_TYPE;

export const VAT_STATUS = {
  pending:    "Хүлээгдэж буй",
  matched:    "Тулгасан",
  reconciled: "Тохиргоологсон",
  declared:   "Тайлагнасан",
  cancelled:  "Цуцалсан",
} as const;
export type VatStatus = keyof typeof VAT_STATUS;

export const SALARY_STATUS = {
  draft:     "Ноорог",
  approved:  "Баталсан",
  posted:    "Журналд орсон",
  paid:      "Олгосон",
  cancelled: "Цуцалсан",
} as const;
export type SalaryStatus = keyof typeof SALARY_STATUS;

export const ASSET_STATUS = {
  active:      "Идэвхтэй",
  inactive:    "Зогссон",
  disposed:    "Хасагдсан",
  written_off: "Хорогдсон",
} as const;
export type AssetStatus = keyof typeof ASSET_STATUS;

export const COMPANY_ROLE = {
  admin:      "Админ",
  accountant: "Нягтлан",
  auditor:    "Аудитор",
  viewer:     "Үзэгч",
} as const;
export type CompanyRole = keyof typeof COMPANY_ROLE;

export const CASH_DIRECTION = {
  income:  "Орлого",
  expense: "Зарлага",
} as const;
export type CashDirection = keyof typeof CASH_DIRECTION;

export const PERIOD_STATUS = {
  open:   "Нээлттэй",
  closed: "Хаагдсан",
  locked: "Тогтоосон",
} as const;
export type PeriodStatus = keyof typeof PERIOD_STATUS;
