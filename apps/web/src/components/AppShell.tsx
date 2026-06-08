"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, BookOpen, Users, Calculator,
  Receipt, Briefcase, LogOut, Settings, ChevronLeft, Menu,
  Banknote, Landmark, HandCoins, Wallet, ScrollText, FileSpreadsheet,
  TrendingUp, PieChart, FileBarChart2, Building2, Coins, Link2,
  ReceiptText, Shield,
} from "lucide-react";
import { useState, useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: string;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  // Гол
  { href: "/",                  label: "Хяналтын самбар",      icon: LayoutDashboard, section: "Гол" },

  // Бүртгэл
  { href: "/journals",          label: "Гүйлгээний бүртгэл",   icon: FileText,        section: "Бүртгэл" },
  { href: "/accounts",          label: "Дансны жагсаалт",      icon: BookOpen,        section: "Бүртгэл" },
  { href: "/partners",          label: "Харилцагчид",          icon: Users,           section: "Бүртгэл" },

  // Мөнгөн хөрөнгө
  { href: "/cash",              label: "Банкны хуулга",        icon: Banknote,        section: "Мөнгөн хөрөнгө" },
  { href: "/cash/summary",      label: "Нэгтгэл",              icon: PieChart,        section: "Мөнгөн хөрөнгө" },
  { href: "/cash/bank-summary", label: "Банкны нэгтгэл",       icon: Landmark,        section: "Мөнгөн хөрөнгө" },

  // Татвар
  { href: "/vat",               label: "НӨАТ бүртгэл",         icon: Receipt,         section: "Татвар" },
  { href: "/recon/barimt-bank", label: "Баримт тулгалт",       icon: Link2,           section: "Татвар" },

  // Авлага / Өглөг
  { href: "/receivables",       label: "Авлага",               icon: HandCoins,       section: "Авлага / Өглөг" },
  { href: "/payables",          label: "Өглөг",                icon: Wallet,          section: "Авлага / Өглөг" },
  { href: "/invoices",          label: "Нэхэмжлэхийн тайлан",  icon: ReceiptText,     section: "Авлага / Өглөг" },
  { href: "/recon/invoices",    label: "Нэхэмж–Банк тулгалт",  icon: Link2,           section: "Авлага / Өглөг" },

  // Хүний нөөц
  { href: "/salary",            label: "Цалингийн бүртгэл",    icon: Coins,           section: "Хүний нөөц" },
  { href: "/salary/employees",  label: "Ажилтнууд",            icon: Users,           section: "Хүний нөөц" },

  // Үндсэн хөрөнгө
  { href: "/fixed-assets",      label: "Үндсэн хөрөнгө",       icon: Briefcase,       section: "Хөрөнгө" },

  // Тайлан
  { href: "/reports",                 label: "Бүх тайлан",             icon: FileBarChart2, section: "Тайлан" },
  { href: "/reports/trial-balance",   label: "Шалгах баланс",          icon: Calculator,    section: "Тайлан" },
  { href: "/reports/balance-sheet",   label: "Санхүү байдлын тайлан",  icon: FileBarChart2, section: "Тайлан" },
  { href: "/reports/income-statement",label: "Орлогын тайлан",         icon: TrendingUp,    section: "Тайлан" },
  { href: "/reports/cashflow",        label: "Мөнгөн гүйлгээ",         icon: ScrollText,    section: "Тайлан" },
  { href: "/reports/cit",             label: "ААНОАТ тайлан",          icon: FileBarChart2, section: "Тайлан" },
  { href: "/reports/ledger",          label: "Дансны хөдөлгөөн",       icon: ScrollText,    section: "Тайлан" },

  // Маягт
  { href: "/forms",             label: "Анхан шатны маягт",    icon: FileSpreadsheet, section: "Маягт" },

  // Удирдлага (зөвхөн админ)
  { href: "/admin/users",       label: "Хэрэглэгчид",          icon: Shield,          section: "Удирдлага", adminOnly: true },
];

export default function AppShell({
  user, role, companyName, children,
}: {
  user: { email: string; id: string };
  role: string;
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  let lastSection = "";

  // Render date after mount so server/client locale mismatch doesn't trip hydration.
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("mn-MN", { dateStyle: "full" }));
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-200 flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-4 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white">Тумэн Accounting</h1>
            <p className="text-xs text-slate-400">{companyName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.filter((item) => !item.adminOnly || role === "admin").map((item) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const active = pathname === item.href ||
                          (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {showSection && (
                  <div className="px-4 pt-3 pb-1 text-[0.65rem] uppercase tracking-wider text-slate-500 font-semibold">
                    {item.section}
                  </div>
                )}
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2 text-xs transition ${
                    active
                      ? "bg-slate-700 text-white border-l-2 border-blue-400"
                      : "hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User card + logout */}
        <div className="border-t border-slate-700 p-3 space-y-2">
          <Link
            href="/profile"
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700/50 transition"
          >
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
              {user.email[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate">{user.email}</div>
              <div className="text-[0.6rem] uppercase text-slate-400">{role}</div>
            </div>
            <Settings className="w-3 h-3 text-slate-500" />
          </Link>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-300 bg-red-900/30 border border-red-800/50 rounded hover:bg-red-900/50 transition"
            >
              <LogOut className="w-3 h-3" />
              Гарах
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between lg:justify-end">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden text-slate-600"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs text-slate-500" suppressHydrationWarning>
            {today || " "}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
