import type { ReactNode } from "react";

export type InfoRow = {
  label: string;
  value: ReactNode;
  /** hide the row when the value is empty */
  hideIfEmpty?: boolean;
};

function isEmpty(value: ReactNode) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "—" ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Simple, readable label/value table used across detail pages.
 */
export function InfoTable({ rows, dense }: { rows: InfoRow[]; dense?: boolean }) {
  const visible = rows.filter((r) => !(r.hideIfEmpty && isEmpty(r.value)));
  if (visible.length === 0) return null;

  return (
    <div className="min-w-0 max-w-full rounded-lg border border-border">
      <table className="w-full table-fixed text-sm">
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={row.label}
              className={i % 2 === 1 ? "bg-muted/40" : undefined}
            >
              <th
                scope="row"
                className={`w-[38%] wrap-anywhere border-b border-border/60 px-3 text-start align-top font-normal text-muted-foreground ${
                  dense ? "py-2" : "py-2.5"
                }`}
              >
                {row.label}
              </th>
              <td
                className={`wrap-anywhere border-b border-border/60 px-3 align-top font-medium ${
                  dense ? "py-2" : "py-2.5"
                }`}
              >
                {isEmpty(row.value) ? "—" : row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
