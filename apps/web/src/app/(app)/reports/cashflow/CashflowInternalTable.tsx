import type { CFInternal, CFRow } from "@/lib/reports/cashflow";
import { fmtMoneyOrDash } from "@/lib/format";

/**
 * Internal cashflow — 12-month columnar table matching legacy
 * `cashflow_report.html` (mode=internal) exactly.
 */
export function CashflowInternalTable({
  data,
  months,
}: {
  data: CFInternal;
  months: string[]; // ["1-р", "2-р", ...]
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table
        className="cf-tbl w-full text-xs border-collapse"
        style={{ minWidth: 1400 }}
      >
        <thead>
          <tr style={{ background: "#1a3c5e", color: "#fff" }}>
            <th className="px-2 py-2 text-left font-semibold" style={{ width: 40 }}>Код</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ minWidth: 240 }}>
              Үзүүлэлт / Тайлбар
            </th>
            {data.months.map((m, i) => (
              <th
                key={m}
                className="px-2 py-2 text-right font-semibold"
                style={{ minWidth: 90 }}
              >
                {months[i]} сар
              </th>
            ))}
            <th
              className="px-2 py-2 text-right font-semibold"
              style={{ minWidth: 110, background: "#0d2137" }}
            >
              Нийт
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <Row key={`r-${i}-${row.code}-${row.label}`} row={row} />
          ))}

          {/* Opening balance row */}
          <tr style={{ background: "#263238", color: "#90CAF9", fontWeight: 600 }}>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5">Эхний үлдэгдэл / Opening Balance</td>
            {data.openingByMonth.map((v, i) => (
              <td key={i} className="px-2 py-1.5 text-right font-mono">
                {v.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}
              </td>
            ))}
            <td className="px-2 py-1.5 text-right font-mono">
              {data.openCash.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}
            </td>
          </tr>

          {/* Closing balance row */}
          <tr style={{ background: "#263238", color: "#A5D6A7", fontWeight: 700 }}>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5">Эцсийн үлдэгдэл / Closing Balance</td>
            {data.closingByMonth.map((v, i) => (
              <td
                key={i}
                className="px-2 py-1.5 text-right font-mono"
                style={v < 0 ? { color: "#FFB74D" } : undefined}
              >
                {v.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}
              </td>
            ))}
            <td
              className="px-2 py-1.5 text-right font-mono"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: data.grandClosing < 0 ? "#FFB74D" : undefined,
              }}
            >
              {data.grandClosing.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: CFRow }) {
  if (row.kind === "section") {
    return (
      <tr style={{ background: row.color ?? "#1565C0", color: "#fff", fontWeight: 700 }}>
        <td className="px-2 py-1.5"></td>
        <td className="px-2 py-1.5 uppercase tracking-wide" colSpan={14}>
          {row.label}
        </td>
      </tr>
    );
  }

  if (row.kind === "subhdr") {
    return (
      <tr style={{ background: "#e8f0fe", fontWeight: 600 }}>
        <td className="px-2 py-1"></td>
        <td className="px-2 py-1 text-xs uppercase text-slate-700" colSpan={14}>
          {row.label}
        </td>
      </tr>
    );
  }

  if (row.kind === "subtotal" || row.kind === "total") {
    return (
      <tr style={{ background: row.color ?? "#37474F", color: "#fff", fontWeight: 700 }}>
        <td className="px-2 py-1.5 font-mono">{row.code}</td>
        <td className="px-2 py-1.5">{row.label}</td>
        {row.vals.map((v, i) => (
          <td key={i} className="px-2 py-1.5 text-right font-mono">
            {v ? v.toLocaleString("mn-MN", { maximumFractionDigits: 0 }) : "—"}
          </td>
        ))}
        <td
          className="px-2 py-1.5 text-right font-mono"
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          {row.total
            ? row.total.toLocaleString("mn-MN", { maximumFractionDigits: 0 })
            : "—"}
        </td>
      </tr>
    );
  }

  // data row
  return (
    <tr className="hover:bg-blue-50/30">
      <td className="px-2 py-1 font-mono text-[0.7rem] text-slate-500 whitespace-nowrap">
        {row.code}
      </td>
      <td className="px-2 py-1 pl-7 text-slate-700">{row.label}</td>
      {row.vals.map((v, i) => (
        <td
          key={i}
          className={`px-2 py-1 text-right font-mono ${v < 0 ? "text-red-600" : ""}`}
        >
          {v ? v.toLocaleString("mn-MN", { maximumFractionDigits: 0 }) : "-"}
        </td>
      ))}
      <td
        className={`px-2 py-1 text-right font-mono font-semibold ${
          row.total < 0 ? "text-red-600" : ""
        }`}
      >
        {fmtMoneyOrDash(row.total).replace(/\.00$/, "")}
      </td>
    </tr>
  );
}
