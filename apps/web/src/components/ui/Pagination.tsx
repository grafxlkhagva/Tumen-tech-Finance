import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-friendly pagination. Builds links by mutating searchParams.
 *
 *   <Pagination page={pageNum} totalPages={Math.ceil(count/PAGE_SIZE)}
 *               basePath="/journals" search={{status: "posted"}} />
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  search = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  search?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const link = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (v !== undefined && v !== "") qs.set(k, v);
    }
    qs.set("page", String(p));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <div>
        Хуудас <b>{page}</b> / {totalPages}
      </div>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link
            href={link(page - 1)}
            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Өмнөх
          </Link>
        ) : (
          <span className="px-3 py-1 text-slate-300 border border-slate-100 rounded flex items-center gap-1 cursor-not-allowed">
            <ChevronLeft className="w-3 h-3" /> Өмнөх
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={link(page + 1)}
            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
          >
            Дараах <ChevronRight className="w-3 h-3" />
          </Link>
        ) : (
          <span className="px-3 py-1 text-slate-300 border border-slate-100 rounded flex items-center gap-1 cursor-not-allowed">
            Дараах <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}
