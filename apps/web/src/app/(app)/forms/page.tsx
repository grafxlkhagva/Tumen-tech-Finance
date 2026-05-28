import Link from "next/link";
import { FileSpreadsheet, ChevronRight } from "lucide-react";

export const metadata = { title: "Маягтууд — Тумэн Accounting" };

const FORMS = [
  { href: "/forms/mh1", title: "МХ-1", desc: "Анхан шатны эргэлтийн баланс" },
  { href: "/forms/mh2", title: "МХ-2", desc: "Орлого-зардлын товчоо" },
  { href: "/forms/t1",  title: "Т-1",  desc: "Тулгалтын маягт (avlaga/payable)" },
  { href: "/forms/t2",  title: "Т-2",  desc: "Авлага/Өглөгийн маягт" },
];

export default function FormsIndexPage() {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6" /> Анхан шатны маягтууд
        </h1>
        <p className="text-sm text-slate-500">Татварын болон санхүүгийн стандарт маягт</p>
      </div>
      <div className="space-y-2">
        {FORMS.map((f) => (
          <Link key={f.href} href={f.href}
            className="block bg-white border border-slate-200 rounded p-4 hover:border-slate-400 transition flex items-center gap-3">
            <div className="text-2xl font-bold text-slate-300 w-16">{f.title}</div>
            <div className="flex-1 text-sm">{f.desc}</div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
