import Link from "next/link";
import {
  Calculator, FileBarChart2, TrendingUp, ScrollText, Building2, ChevronRight,
} from "lucide-react";

export const metadata = { title: "Тайлангууд — Тумэн Accounting" };

const REPORTS = [
  { href: "/reports/trial-balance",   title: "Шалгах баланс",         desc: "Бүх дансны Dr/Cr нийлбэр (posted journal-аас)", icon: Calculator },
  { href: "/reports/balance-sheet",   title: "Санхүү байдлын тайлан", desc: "Хөрөнгө = Өр төлбөр + Эзний өмч (point-in-time)", icon: FileBarChart2 },
  { href: "/reports/income-statement",title: "Орлогын тайлан",        desc: "Орлого − Зардал = Ашиг (period)", icon: TrendingUp },
  { href: "/reports/cashflow",        title: "Мөнгөн гүйлгээ",        desc: "Кассын орлого/зарлага ангилалаар", icon: ScrollText },
  { href: "/reports/equity",          title: "Өмчийн өөрчлөлт",       desc: "Эзний өмчийн дансны хөдөлгөөн", icon: Building2 },
  { href: "/reports/cit",             title: "ААНОАТ тайлан",         desc: "Татвар тооцоолол (10% ≤ 3 тэрбум, 25% дээш)", icon: FileBarChart2 },
  { href: "/reports/ledger",          title: "Дансны хөдөлгөөн",      desc: "Данс тус бүрийн дэлгэрэнгүй гүйлгээ", icon: ScrollText },
];

export default function ReportsIndexPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Тайлангийн жагсаалт</h1>
        <p className="text-sm text-slate-500">Posted журналаас тооцоологдсон санхүүгийн тайлангууд</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}
            className="group bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-400 hover:shadow-sm transition flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition">
              <r.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
