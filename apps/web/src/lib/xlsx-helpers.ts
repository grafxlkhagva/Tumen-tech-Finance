import * as XLSX from "xlsx";

/**
 * Generate an Xlsx file from a worksheet array and return it as a NextResponse
 * with the right content-type and download headers.
 */
export function buildXlsxResponse(
  filename: string,
  sheets: Array<{ name: string; data: (string | number | null)[][] }>,
): Response {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
