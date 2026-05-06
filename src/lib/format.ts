export function formatDevisNumber(n: number, kind: "devis" | "facture" = "devis"): string {
  const prefix = kind === "facture" ? "FACT" : "EST";
  return `${prefix}-${String(n).padStart(7, "0")}`;
}

export function formatDt(value: number): string {
  return `${Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DT`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
