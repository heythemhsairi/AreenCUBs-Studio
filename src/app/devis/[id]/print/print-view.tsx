"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";

type Devis = {
  kind: "devis" | "facture";
  devis_number: number;
  date: string;
  due_date: string;
  object: string | null;
  subtotal_dt: number;
  discount_dt: number;
  tva_dt: number;
  tva_rate: number;
  stamp_dt: number;
  total_dt: number;
};

type Client = {
  name: string;
  address: string | null;
  matricule_fiscal: string | null;
} | null;

type Item = {
  description: string;
  quantity: number;
  unit_price_dt: number;
  line_total_dt: number;
  is_bonus: boolean;
};

export function DevisPrintView({
  devis,
  client,
  items,
  settings,
}: {
  devis: Devis;
  client: Client;
  items: Item[];
  settings: AppSettings;
}) {
  const isFacture = devis.kind === "facture";
  const docType = isFacture ? "FACTURE" : "DEVIS";
  const fullNumber = formatDevisNumber(devis.devis_number, devis.kind);

  // Density modes — drive vertical compression by line count so a short quote
  // breathes and a long one tightens up to stay on one page when feasible.
  // 1–6: normal · 7–12: compact · 13+: long (multi-page allowed, tightest).
  const n = items.length;
  const density = n <= 6 ? "normal" : n <= 12 ? "compact" : "long";

  useEffect(() => {
    // The browser's "Save as PDF" defaults to document.title.
    const prev = document.title;
    document.title = `${isFacture ? "Facture" : "Devis"}-${fullNumber}`;
    const t = setTimeout(() => window.print(), 400);
    return () => {
      clearTimeout(t);
      document.title = prev;
    };
  }, [isFacture, fullNumber]);

  return (
    <div className={`doc density-${density}`}>
      {/* ── Header: brand left, document type + number right ── */}
      <header className="doc-header">
        <div className="brand">
          <BrandLogo width={150} className="brand-logo" />
        </div>
        <div className="doc-id">
          <div className="doc-type">{docType}</div>
          <div className="doc-number">{fullNumber}</div>
        </div>
      </header>

      {/* ── Meta row: date / due date / object, compact inline ── */}
      <section className="meta">
        <div className="meta-item">
          <span className="meta-label">Date</span>
          <span className="meta-value">{formatDate(devis.date)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Échéance</span>
          <span className="meta-value">{formatDate(devis.due_date)}</span>
        </div>
        {devis.object && (
          <div className="meta-item meta-item--object">
            <span className="meta-label">Objet</span>
            <span className="meta-value">{devis.object}</span>
          </div>
        )}
      </section>

      {/* ── Parties: two compact cards side by side ── */}
      <section className="parties">
        <div className="party">
          <div className="party-tag">Expéditeur</div>
          <div className="party-box">
            <div className="party-name">{settings.company_name}</div>
            {settings.company_address && (
              <div className="party-line">{settings.company_address}</div>
            )}
            {settings.matricule_fiscal && (
              <div className="party-line">
                M.F : {settings.matricule_fiscal}
              </div>
            )}
          </div>
        </div>
        <div className="party">
          <div className="party-tag">Client</div>
          <div className="party-box party-box--client">
            <div className="party-name">{client?.name ?? "—"}</div>
            {client?.address && (
              <div className="party-line">{client.address}</div>
            )}
            {client?.matricule_fiscal && (
              <div className="party-line">M.F : {client.matricule_fiscal}</div>
            )}
          </div>
        </div>
      </section>

      {/* ── Line items table ── */}
      <table className="items">
        <thead>
          <tr>
            <th className="col-desc">Description</th>
            <th className="col-tax">Taxe</th>
            <th className="col-unit right">P.U.</th>
            <th className="col-qty right">Qté</th>
            <th className="col-price right">Prix</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="col-desc">{it.description}</td>
              <td className="col-tax">TVA {Number(devis.tva_rate).toFixed(0)}%</td>
              <td className="col-unit right">
                {it.is_bonus ? "Bonus" : `${it.unit_price_dt} DT`}
              </td>
              <td className="col-qty right">{it.quantity}</td>
              <td className="col-price right">
                {it.is_bonus ? "Bonus" : `${it.line_total_dt} DT`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Tail: signature (left) + totals (right). Flows right under the
             table; does NOT carry break-inside on the whole block so it can
             never be orphaned onto a blank page. ── */}
      <div className="doc-tail">
        <section className="signature">
          <div className="signature-tag">Cachet &amp; Signature</div>
          <div className="signature-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/stamp.png"
              alt="Cachet et signature Areen CUBs"
              className="signature-stamp"
            />
          </div>
        </section>

        <section className="totals">
          <div className="totals-inner">
            <div className="totals-row">
              <span>Sous total</span>
              <strong>{formatDt(devis.subtotal_dt)}</strong>
            </div>
            {devis.discount_dt > 0 && (
              <>
                <div className="totals-row totals-row--discount">
                  <span>Remise</span>
                  <strong>− {formatDt(devis.discount_dt)}</strong>
                </div>
                <div className="totals-row totals-row--net">
                  <span>Net HT</span>
                  <strong>
                    {formatDt(devis.subtotal_dt - devis.discount_dt)}
                  </strong>
                </div>
              </>
            )}
            <div className="totals-row">
              <span>TVA ({Number(devis.tva_rate).toFixed(0)}%)</span>
              <strong>{formatDt(devis.tva_dt)}</strong>
            </div>
            {devis.stamp_dt > 0 && (
              <div className="totals-row">
                <span>Timbre fiscal</span>
                <strong>{formatDt(devis.stamp_dt)}</strong>
              </div>
            )}
            <div className="totals-row totals-row--final">
              <span>Total TTC</span>
              <strong>{formatDt(devis.total_dt)}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* ── Compact single-line footer ── */}
      <footer className="footer">
        {settings.email} · {settings.phone} · {settings.website}
      </footer>

      <div className="print-controls">
        <button onClick={() => window.print()}>Imprimer / PDF</button>
      </div>

      <style jsx global>{`
        :root {
          --brand: #3b8bba;
          --brand-dark: #2c6e96;
          --accent: #ff9e1f;
          --ink: #1e1e24;
          --muted: #6b6b75;
          --line: rgba(30, 30, 36, 0.12);
          --paper: #ffffff;
          /* density-driven spacing knobs (overridden per .density-* below) */
          --gap: 6mm;
          --row-pad: 2.4mm;
          --base-fs: 10pt;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #e9eef2;
          color: var(--ink);
          font-family: var(--font-franklin), ui-sans-serif, system-ui,
            -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: var(--base-fs);
          line-height: 1.4;
        }

        .doc {
          width: 210mm;
          min-height: 297mm;
          margin: 16px auto;
          padding: 14mm 14mm 10mm;
          background: var(--paper);
          box-sizing: border-box;
          box-shadow: 0 4px 24px rgba(30, 30, 36, 0.14);
          display: flex;
          flex-direction: column;
        }

        /* ── Density tiers ─────────────────────────────────────────────── */
        .density-compact {
          --gap: 4.5mm;
          --row-pad: 1.8mm;
          --base-fs: 9.5pt;
        }
        .density-long {
          --gap: 3.5mm;
          --row-pad: 1.4mm;
          --base-fs: 9pt;
        }

        /* ── Header ────────────────────────────────────────────────────── */
        .doc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 3mm;
          margin-bottom: var(--gap);
          border-bottom: 2px solid var(--brand);
        }
        .brand-logo {
          color: var(--brand) !important;
        }
        .doc-id {
          text-align: right;
          line-height: 1.1;
        }
        .doc-type {
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--muted);
        }
        .doc-number {
          font-size: 19pt;
          font-weight: 800;
          color: var(--brand);
          letter-spacing: -0.3px;
        }

        /* ── Meta inline row ───────────────────────────────────────────── */
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 3mm 8mm;
          margin-bottom: var(--gap);
          font-size: 9.5pt;
        }
        .meta-item {
          display: flex;
          gap: 2mm;
          align-items: baseline;
        }
        .meta-item--object {
          flex: 1 1 100%;
        }
        .meta-label {
          text-transform: uppercase;
          font-size: 7.5pt;
          letter-spacing: 0.5px;
          color: var(--muted);
          font-weight: 700;
        }
        .meta-value {
          font-weight: 600;
        }

        /* ── Parties ───────────────────────────────────────────────────── */
        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: var(--gap);
        }
        .party-tag {
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--muted);
          font-size: 7.5pt;
          font-weight: 700;
          margin-bottom: 1mm;
        }
        .party-box {
          background: rgba(59, 139, 186, 0.07);
          border-left: 3px solid var(--brand);
          border-radius: 1.5mm;
          padding: 2.5mm 3mm;
          font-size: 9pt;
        }
        .party-box--client {
          background: rgba(255, 158, 31, 0.08);
          border-left-color: var(--accent);
        }
        .party-name {
          font-weight: 800;
          font-size: 11pt;
          margin-bottom: 0.5mm;
          color: var(--ink);
        }
        .party-line {
          color: #45454d;
          word-break: break-word;
        }

        /* ── Table ─────────────────────────────────────────────────────── */
        .items {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--base-fs);
          margin-bottom: var(--gap);
        }
        .items thead th {
          background: var(--brand);
          color: #fff;
          text-align: left;
          padding: var(--row-pad) 3mm;
          font-weight: 700;
          font-size: 8.5pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .items thead th.right {
          text-align: right;
        }
        .items tbody td {
          padding: var(--row-pad) 3mm;
          border-bottom: 1px solid var(--line);
          vertical-align: top;
        }
        .items tbody tr:nth-child(even) td {
          background: rgba(30, 30, 36, 0.025);
        }
        .items td.right,
        .items th.right {
          text-align: right;
        }
        .col-desc {
          width: 52%;
          word-break: break-word;
        }
        .col-tax {
          width: 14%;
          white-space: nowrap;
        }
        .col-unit {
          width: 13%;
          white-space: nowrap;
        }
        .col-qty {
          width: 8%;
        }
        .col-price {
          width: 13%;
          white-space: nowrap;
          font-weight: 600;
        }

        /* ── Tail: signature + totals on one row ───────────────────────── */
        .doc-tail {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8mm;
        }
        .signature {
          flex-shrink: 0;
        }
        .signature-tag {
          font-size: 8.5pt;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 1.5mm;
        }
        .signature-box {
          width: 58mm;
          height: 25mm;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .signature-stamp {
          max-width: 48mm; /* ~180px */
          max-height: 19mm; /* ~70px */
          object-fit: contain;
          mix-blend-mode: multiply;
        }

        .totals {
          flex-shrink: 0;
        }
        .totals-inner {
          width: 70mm;
          font-size: 9.5pt;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 1mm 0;
        }
        .totals-row--discount {
          color: #c0392b;
        }
        .totals-row--net {
          border-top: 1px dashed var(--line);
          padding-top: 1.2mm;
          margin-top: 0.6mm;
          font-weight: 600;
        }
        .totals-row--final {
          border-top: 2px solid var(--brand);
          margin-top: 1.5mm;
          padding-top: 2mm;
          font-size: 12.5pt;
          font-weight: 800;
          color: var(--brand);
        }

        /* ── Footer ────────────────────────────────────────────────────── */
        .footer {
          margin-top: auto;
          padding-top: 4mm;
          text-align: center;
          color: var(--muted);
          font-size: 8.5pt;
          border-top: 1px solid var(--line);
        }

        /* ── Print-only control button ─────────────────────────────────── */
        .print-controls {
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 999;
        }
        .print-controls button {
          background: var(--brand);
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(59, 139, 186, 0.4);
        }
        .print-controls button:hover {
          background: var(--brand-dark);
        }

        /* ── Page-break behaviour ──────────────────────────────────────── */
        /* Keep a single row intact, and keep the small signature / totals
           sub-blocks intact — but NOT the whole tail, so it can sit right
           under the table instead of being shoved to a blank second page. */
        .items tr {
          break-inside: avoid;
        }
        .signature,
        .totals-inner {
          break-inside: avoid;
        }

        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html,
          body {
            background: #fff;
          }
          .doc {
            margin: 0;
            box-shadow: none;
          }
          /* Repeat the table header on every printed page for long docs. */
          .items thead {
            display: table-header-group;
          }
          .print-controls {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
