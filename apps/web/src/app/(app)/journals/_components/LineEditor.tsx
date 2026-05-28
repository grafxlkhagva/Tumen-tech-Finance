"use client";

import { useReducer, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AccountPicker, type AccountOption } from "@/components/ui/AccountPicker";
import { PartnerPicker, type PartnerOption } from "@/components/ui/PartnerPicker";
import { fmtMoney } from "@/lib/format";

type Line = {
  uid: string;
  account_id: string;
  account_label: string;
  partner_id: string;
  partner_label: string;
  debit: string;
  credit: string;
  description: string;
};

type State = { lines: Line[] };
type Action =
  | { type: "add" }
  | { type: "remove"; uid: string }
  | { type: "update"; uid: string; patch: Partial<Line> };

function makeLine(): Line {
  return {
    uid: Math.random().toString(36).slice(2),
    account_id: "",
    account_label: "",
    partner_id: "",
    partner_label: "",
    debit: "",
    credit: "",
    description: "",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add":
      return { lines: [...state.lines, makeLine()] };
    case "remove":
      return { lines: state.lines.filter((l) => l.uid !== action.uid) };
    case "update":
      return {
        lines: state.lines.map((l) =>
          l.uid === action.uid ? { ...l, ...action.patch } : l,
        ),
      };
  }
}

/**
 * Interactive journal-line editor. Renders a table where each row is
 * (account, partner, debit, credit, description). The serialized JSON
 * is written into a hidden <input name="lines_data"> for the Server Action.
 *
 * Balance is computed live and shown in the footer.
 */
export function LineEditor({ initial }: { initial?: Line[] }) {
  const [state, dispatch] = useReducer(reducer, {
    lines: initial && initial.length > 0 ? initial : [makeLine(), makeLine()],
  });
  const formRef = useRef<HTMLDivElement>(null);
  const [forceVer, setForceVer] = useState(0);

  const totalDr = state.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = state.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = totalDr - totalCr;
  const balanced = Math.abs(diff) < 0.005 && totalDr > 0;

  const serialized = JSON.stringify(
    state.lines
      .filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({
        account_id: l.account_id,
        partner_id: l.partner_id || null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || null,
      })),
  );

  return (
    <div ref={formRef} className="space-y-3">
      <input type="hidden" name="lines_data" value={serialized} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left min-w-[220px]">Данс</th>
              <th className="px-2 py-2 text-left min-w-[180px]">Харилцагч</th>
              <th className="px-2 py-2 text-right w-32">Дебит</th>
              <th className="px-2 py-2 text-right w-32">Кредит</th>
              <th className="px-2 py-2 text-left min-w-[150px]">Тайлбар</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.lines.map((line, idx) => (
              <tr key={line.uid + ":" + forceVer} className="bg-white">
                <td className="px-2 py-2 text-xs text-slate-400">{idx + 1}</td>
                <td className="px-2 py-2">
                  <AccountPicker
                    name={`__acc_${line.uid}`}
                    defaultId={line.account_id || undefined}
                    defaultLabel={line.account_label || undefined}
                    onChange={(opt: AccountOption | null) =>
                      dispatch({
                        type: "update",
                        uid: line.uid,
                        patch: {
                          account_id: opt?.id ?? "",
                          account_label: opt ? `${opt.code} ${opt.name}` : "",
                        },
                      })
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <PartnerPicker
                    name={`__partner_${line.uid}`}
                    defaultId={line.partner_id || undefined}
                    defaultLabel={line.partner_label || undefined}
                    onChange={(opt: PartnerOption | null) =>
                      dispatch({
                        type: "update",
                        uid: line.uid,
                        patch: {
                          partner_id: opt?.id ?? "",
                          partner_label: opt?.name ?? "",
                        },
                      })
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={line.debit}
                    onChange={(e) => {
                      const v = e.target.value;
                      dispatch({
                        type: "update",
                        uid: line.uid,
                        patch: { debit: v, credit: v ? "" : line.credit },
                      });
                    }}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={line.credit}
                    onChange={(e) => {
                      const v = e.target.value;
                      dispatch({
                        type: "update",
                        uid: line.uid,
                        patch: { credit: v, debit: v ? "" : line.debit },
                      });
                    }}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) =>
                      dispatch({
                        type: "update",
                        uid: line.uid,
                        patch: { description: e.target.value },
                      })
                    }
                    placeholder="Тайлбар..."
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  {state.lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: "remove", uid: line.uid });
                        setForceVer((v) => v + 1);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Хасах"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr className="border-t-2 border-slate-300">
              <td colSpan={3} className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "add" })}
                  className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Мөр нэмэх
                </button>
              </td>
              <td className="px-2 py-2 text-right font-mono font-semibold">
                {fmtMoney(totalDr)}
              </td>
              <td className="px-2 py-2 text-right font-mono font-semibold">
                {fmtMoney(totalCr)}
              </td>
              <td className="px-2 py-2 text-right text-xs">
                <span className={balanced ? "text-green-600" : "text-red-600"}>
                  {balanced ? "✓ Тэнцсэн" : `Зөрүү ${fmtMoney(diff)}`}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
