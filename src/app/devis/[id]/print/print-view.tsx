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
  tva_dt: number;
  tva_rate: number;
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
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  const isFacture = devis.kind === "facture";
  const docTitle = isFacture ? "Facture." : "Devis.";
  const numberLabel = isFacture ? "#FACT" : "#EST";
  const numberFormatted = formatDevisNumber(devis.devis_number, devis.kind).replace(
    /^(EST|FACT)-/,
    "",
  );

  return (
    <div className="devis-page">
      <header className="devis-header">
        <h1 className="devis-title">{docTitle}</h1>
        <div className="brand">
          <BrandLogo width={170} className="brand-logo" />
        </div>
      </header>

      <section className="meta">
        <div className="meta-no">
          {numberLabel} : {numberFormatted}
        </div>
        <div className="meta-row">
          <strong>Date :</strong> {formatDate(devis.date)}
        </div>
        <div className="meta-row">
          <strong>Échéance :</strong> {formatDate(devis.due_date)}
        </div>
        {devis.object && (
          <div className="meta-row">
            <strong>Objet :</strong> {devis.object}
          </div>
        )}
      </section>

      <section className="parties">
        <div className="party">
          <div className="party-tag">Expéditeur :</div>
          <div className="party-box">
            <div className="party-name">{settings.company_name}</div>
            <div>Adresse: {settings.company_address}</div>
            <div className="mt">Matricule Fiscal: {settings.matricule_fiscal}</div>
          </div>
        </div>
        <div className="party">
          <div className="party-tag">Envoyer à :</div>
          <div className="party-box party-box--client">
            <div className="party-name">{client?.name ?? "—"}</div>
            {client?.address && <div>Adresse: {client.address}</div>}
            {client?.matricule_fiscal && (
              <div className="mt">
                Matricule Fiscal: {client.matricule_fiscal}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <table className="items">
          <thead>
            <tr>
              <th>Description</th>
              <th>Taxe</th>
              <th>P.U.</th>
              <th>Quantité</th>
              <th className="right">Prix</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.description}</td>
                <td>TVA {Number(devis.tva_rate).toFixed(0)}%</td>
                <td>{it.is_bonus ? "Bonus" : `${it.unit_price_dt} DT`}</td>
                <td>{it.quantity}</td>
                <td className="right">
                  {it.is_bonus ? "Bonus" : `${it.line_total_dt} DT`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="totals">
        <div className="totals-inner">
          <div className="totals-row">
            <span>Sous total :</span>
            <strong>{formatDt(devis.subtotal_dt)}</strong>
          </div>
          <div className="totals-row">
            <span>TVA ({Number(devis.tva_rate).toFixed(0)}%) :</span>
            <strong>{formatDt(devis.tva_dt)}</strong>
          </div>
          <div className="totals-row totals-row--final">
            <span>Total TTC :</span>
            <strong>{formatDt(devis.total_dt)}</strong>
          </div>
        </div>
      </section>

      <section className="signature">
        <div className="signature-tag">Cachet &amp; Signature</div>
        <div className="signature-box">
          {/*
            Areen CUBs official stamp + signature. The file lives at
            public/stamp.png so it ships with the build and prints
            inside the signature box on every devis / facture PDF.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/stamp.png"
            alt="Cachet et signature Areen CUBs"
            className="signature-stamp"
          />
        </div>
      </section>

      <footer className="footer">
        <span>📧 {settings.email}</span>
        <span>📞 {settings.phone}</span>
        <span>🌐 {settings.website}</span>
      </footer>

      <div className="print-controls">
        <button onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
      </div>

      <style jsx global>{`
        :root {
          --brand: #3b8bba;
          --brand-dark: #2c6e96;
          --accent: #ff9e1f;
          --ink: #1e1e24;
          --muted: #6b6b75;
          --cream: #fff8f0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #f4ece0;
          color: var(--ink);
          font-family: var(--font-franklin), ui-sans-serif, system-ui,
            -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.45;
        }

        .devis-page {
          width: 210mm;
          min-height: 297mm;
          margin: 16px auto;
          padding: 18mm 16mm 14mm;
          background: var(--cream);
          box-sizing: border-box;
          box-shadow: 0 4px 24px rgba(30, 30, 36, 0.12);
          position: relative;
        }

        .devis-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6mm;
          padding-bottom: 4mm;
          border-bottom: 2px solid var(--brand);
        }

        .devis-title {
          margin: 0;
          font-size: 38pt;
          font-weight: 800;
          color: var(--brand);
          letter-spacing: -1px;
          line-height: 1;
        }

        .brand {
          display: flex;
          align-items: center;
        }
        .brand-logo {
          color: var(--brand) !important;
        }

        .meta {
          margin-bottom: 6mm;
        }
        .meta-no {
          font-weight: 700;
          color: var(--brand);
          font-size: 11pt;
          margin-bottom: 2mm;
          letter-spacing: 0.5px;
        }
        .meta-row {
          font-size: 10pt;
          margin-top: 0.5mm;
        }

        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6mm;
          margin: 4mm 0 8mm;
        }
        .party-tag {
          font-style: italic;
          color: var(--muted);
          font-size: 9pt;
          margin-bottom: 1mm;
        }
        .party-box {
          background: rgba(59, 139, 186, 0.08);
          border-left: 3px solid var(--brand);
          border-radius: 2mm;
          padding: 3mm 4mm;
          font-size: 9.5pt;
        }
        .party-box--client {
          background: rgba(255, 158, 31, 0.08);
          border-left-color: var(--accent);
        }
        .party-box .party-name {
          font-weight: 800;
          color: var(--ink);
          font-size: 13pt;
          margin-bottom: 1mm;
        }
        .party-box .mt {
          margin-top: 2mm;
        }

        .items {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .items thead th {
          background: var(--brand);
          color: #fff;
          text-align: left;
          padding: 2.5mm 3mm;
          font-weight: 700;
          font-size: 9.5pt;
        }
        .items thead th.right {
          text-align: right;
        }
        .items tbody td {
          padding: 2.5mm 3mm;
          border-bottom: 1px solid rgba(30, 30, 36, 0.08);
          vertical-align: top;
        }
        .items tbody tr:nth-child(even) td {
          background: rgba(30, 30, 36, 0.02);
        }
        .items tbody td.right {
          text-align: right;
        }

        .totals {
          display: flex;
          justify-content: flex-end;
          margin-top: 6mm;
        }
        .totals-inner {
          width: 70mm;
          font-size: 10pt;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 1.5mm 0;
        }
        .totals-row--final {
          border-top: 1px solid var(--brand);
          margin-top: 2mm;
          padding-top: 3mm;
          font-size: 12pt;
          font-weight: 800;
          color: var(--brand);
        }

        .signature {
          margin-top: 10mm;
          width: 70mm;
          margin-left: auto;
        }
        .signature-tag {
          font-weight: 700;
          margin-bottom: 2mm;
          text-align: center;
        }
        .signature-box {
          height: 36mm;
          border: 1px solid rgba(30, 30, 36, 0.2);
          border-radius: 2mm;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2mm;
          background: #fff;
        }
        .signature-stamp {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          /* slight multiply blend so the stamp ink reads naturally on the
             cream paper background of the page without a hard white box */
          mix-blend-mode: multiply;
        }

        .footer {
          position: absolute;
          left: 16mm;
          right: 16mm;
          bottom: 8mm;
          display: flex;
          justify-content: space-between;
          color: var(--muted);
          font-size: 9pt;
          border-top: 1px solid rgba(30, 30, 36, 0.1);
          padding-top: 3mm;
        }

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

        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html,
          body {
            background: #fff;
          }
          .devis-page {
            margin: 0;
            box-shadow: none;
            page-break-after: always;
          }
          .print-controls {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
