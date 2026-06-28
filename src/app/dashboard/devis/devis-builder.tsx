"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { createDevisAction, updateDevisAction } from "./actions";
import { formatDt } from "@/lib/format";

type Service = {
  id: string;
  name_fr: string;
  name_en?: string | null;
  default_price_dt: number;
  default_unit: string;
  category: string | null;
};

type Client = { id: string; name: string };

type LineItem = {
  key: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price_dt: number;
  is_bonus: boolean;
};

type Devis = {
  id: string;
  client_id: string;
  date: string;
  due_date: string;
  object: string | null;
  notes: string | null;
  devis_number?: number;
  discount_dt?: number;
  stamp_dt?: number;
  items: Array<{
    service_id: string | null;
    description: string;
    quantity: number;
    unit_price_dt: number;
    is_bonus: boolean;
  }>;
};

export type DevisKind = "devis" | "facture";

type Props =
  | {
      mode: "create";
      kind: DevisKind;
      defaultClientId?: string;
      clients: Client[];
      services: Service[];
      devis?: undefined;
    }
  | {
      mode: "edit";
      kind: DevisKind;
      devis: Devis;
      clients: Client[];
      services: Service[];
      defaultClientId?: undefined;
    };

const TVA_RATE = 19;
// Tunisian fiscal stamp (timbre fiscal) — fixed fee added on top of the
// TVA-inclusive total, untaxed. Mirrors STAMP_DT in actions.ts.
const STAMP_DT = 1;
const todayIso = () => new Date().toISOString().slice(0, 10);
const plus14Iso = () =>
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let keyCounter = 0;
const nextKey = () => `row-${++keyCounter}`;

export function DevisBuilder(props: Props) {
  const { t, locale } = useI18n();
  const db = t.devisBuilder;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const docLabel =
    props.kind === "facture"
      ? locale === "en" ? "Invoice" : "Facture"
      : locale === "en" ? "Quote" : "Devis";

  const [clientId, setClientId] = useState(
    props.mode === "edit"
      ? props.devis.client_id
      : (props.defaultClientId ?? ""),
  );
  const [date, setDate] = useState(
    props.mode === "edit" ? props.devis.date : todayIso(),
  );
  const [dueDate, setDueDate] = useState(
    props.mode === "edit" ? props.devis.due_date : plus14Iso(),
  );
  const [object, setObject] = useState(
    props.mode === "edit"
      ? (props.devis.object ?? "")
      : props.kind === "facture"
        ? "Facture pour services rendus"
        : "Création d'identité visuelle et supports de communication",
  );
  const [notes, setNotes] = useState(
    props.mode === "edit" ? (props.devis.notes ?? "") : "",
  );
  const [docNumber, setDocNumber] = useState(
    props.mode === "edit" && props.devis.devis_number != null
      ? String(props.devis.devis_number)
      : "",
  );
  const [discountDt, setDiscountDt] = useState<number>(
    props.mode === "edit" ? Number(props.devis.discount_dt ?? 0) : 0,
  );
  // Fiscal stamp: in edit mode reflect the saved value; when creating, default
  // ON for factures (legal requirement) and OFF for devis.
  const [applyStamp, setApplyStamp] = useState<boolean>(
    props.mode === "edit"
      ? Number(props.devis.stamp_dt ?? 0) > 0
      : props.kind === "facture",
  );

  const [items, setItems] = useState<LineItem[]>(() =>
    props.mode === "edit"
      ? props.devis.items.map((it) => ({ ...it, key: nextKey() }))
      : [
          {
            key: nextKey(),
            service_id: null,
            description: "",
            quantity: 1,
            unit_price_dt: 0,
            is_bonus: false,
          },
        ],
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, it) =>
        sum + (it.is_bonus ? 0 : it.quantity * (it.unit_price_dt || 0)),
      0,
    );
    const discount = Math.max(0, Math.min(subtotal, discountDt || 0));
    const net = subtotal - discount;
    const tva = +((net * TVA_RATE) / 100).toFixed(2);
    const stamp = applyStamp ? STAMP_DT : 0;
    const total = +(net + tva + stamp).toFixed(2);
    return {
      subtotal: +subtotal.toFixed(2),
      discount: +discount.toFixed(2),
      tva,
      stamp: +stamp.toFixed(2),
      total,
    };
  }, [items, discountDt, applyStamp]);

  const discountPct =
    totals.subtotal > 0 ? (totals.discount / totals.subtotal) * 100 : 0;

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        service_id: null,
        description: "",
        quantity: 1,
        unit_price_dt: 0,
        is_bonus: false,
      },
    ]);
  }

  function removeRow(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function updateRow(key: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  function serviceName(svc: Service) {
    return locale === "en" && svc.name_en ? svc.name_en : svc.name_fr;
  }

  function applyService(rowKey: string, serviceId: string) {
    const svc = props.services.find((s) => s.id === serviceId);
    if (!svc) return;
    updateRow(rowKey, {
      service_id: svc.id,
      description: serviceName(svc),
      unit_price_dt: Number(svc.default_price_dt),
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (props.mode === "edit") fd.set("id", props.devis.id);
    fd.set("client_id", clientId);
    fd.set("kind", props.kind);
    fd.set("date", date);
    fd.set("due_date", dueDate);
    fd.set("object", object);
    fd.set("notes", notes);
    fd.set("devis_number", docNumber.trim());
    fd.set("discount_dt", String(discountDt || 0));
    if (applyStamp) fd.set("apply_stamp", "on");
    fd.set(
      "items_json",
      JSON.stringify(
        items.map((it) => ({
          service_id: it.service_id,
          description: it.description,
          quantity: it.quantity,
          unit_price_dt: it.unit_price_dt,
          is_bonus: it.is_bonus,
        })),
      ),
    );

    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createDevisAction(fd)
          : await updateDevisAction(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  const baseListUrl =
    props.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          props.mode === "create"
            ? db.newDoc(docLabel.toLowerCase())
            : db.editDoc(docLabel.toLowerCase())
        }
        subtitle={
          <Link href={baseListUrl} className="hover:underline">
            ← {props.kind === "facture" ? t.factures.title : t.devis.title}
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{db.infoCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={db.labelClient}>
                <Select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">{db.chooseClient}</option>
                  {props.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={db.labelObject}>
                <Input
                  value={object}
                  onChange={(e) => setObject(e.target.value)}
                />
              </Field>
              <Field
                label={`${db.labelNumber(docLabel)}${
                  props.mode === "create" ? db.labelNumberAuto : ""
                }`}
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder={props.mode === "create" ? db.autoNumber : ""}
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                />
              </Field>
              <Field label={db.labelDate}>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label={db.labelDueDate}>
                <Input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{db.linesCard}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-ink/50 md:grid">
              <div className="col-span-5">{db.colDescription}</div>
              <div className="col-span-2">{db.colUnit}</div>
              <div className="col-span-1">{db.colQty}</div>
              <div className="col-span-2 text-right">{db.colTotal}</div>
              <div className="col-span-1 text-center">{db.colBonus}</div>
              <div className="col-span-1" />
            </div>

            {items.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-1 gap-2 rounded-md border border-ink/10 bg-cream/40 p-3 md:grid-cols-12 md:items-center md:border-0 md:bg-transparent md:p-0"
              >
                <div className="md:col-span-5">
                  <Select
                    className="mb-1"
                    value={item.service_id ?? ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        applyService(item.key, e.target.value);
                      } else {
                        updateRow(item.key, { service_id: null });
                      }
                    }}
                  >
                    <option value="">{db.servicePlaceholder}</option>
                    {props.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {serviceName(s)} ({s.default_price_dt} DT)
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder={db.descriptionPlaceholder}
                    value={item.description}
                    onChange={(e) =>
                      updateRow(item.key, { description: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price_dt}
                    disabled={item.is_bonus}
                    onChange={(e) =>
                      updateRow(item.key, {
                        unit_price_dt: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateRow(item.key, {
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="font-medium text-ink md:col-span-2 md:text-right">
                  {item.is_bonus
                    ? db.bonus
                    : formatDt(item.quantity * (item.unit_price_dt || 0))}
                </div>
                <label className="flex items-center justify-center gap-1.5 text-xs text-ink/60 md:col-span-1">
                  <input
                    type="checkbox"
                    checked={item.is_bonus}
                    onChange={(e) =>
                      updateRow(item.key, {
                        is_bonus: e.target.checked,
                        unit_price_dt: e.target.checked
                          ? 0
                          : item.unit_price_dt,
                      })
                    }
                  />
                  {db.bonus}
                </label>
                <div className="md:col-span-1 md:text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(item.key)}
                    className="text-xs text-red-600 hover:underline"
                    title={db.deleteLineTitle}
                  >
                    {db.deleteLine}
                  </button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              {db.addLine}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{db.totalsCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <Row label={db.subtotal} value={formatDt(totals.subtotal)} />

              <div className="grid grid-cols-1 gap-2 rounded-lg bg-cream-dark/40 p-3 sm:grid-cols-[1fr_120px_100px] sm:items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink/60">
                  {db.discount}
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountDt}
                  onChange={(e) => setDiscountDt(Number(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <span className="text-right text-xs text-ink/55">
                  {totals.discount > 0
                    ? `−${discountPct.toFixed(1)}%`
                    : db.discountUnit}
                </span>
              </div>

              {totals.discount > 0 && (
                <Row
                  label={db.afterDiscount}
                  value={formatDt(totals.subtotal - totals.discount)}
                />
              )}
              <Row label={db.tva} value={formatDt(totals.tva)} />

              {/* Fiscal stamp toggle */}
              <label className="flex items-center justify-between gap-3 rounded-lg bg-cream-dark/40 p-3">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/60">
                  <input
                    type="checkbox"
                    checked={applyStamp}
                    onChange={(e) => setApplyStamp(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 accent-brand"
                  />
                  {db.stamp}
                </span>
                <span className="text-right text-xs text-ink/55">
                  {applyStamp ? formatDt(totals.stamp) : formatDt(STAMP_DT)}
                </span>
              </label>

              <div className="border-t border-ink/10 pt-2">
                <Row
                  label={db.totalTtc}
                  value={formatDt(totals.total)}
                  bold
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{db.notesCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending
              ? t.common.saving
              : props.mode === "create"
                ? props.kind === "facture"
                  ? db.createFacture
                  : db.createDevis
                : t.common.save}
          </Button>
          <Link
            href={
              props.mode === "create"
                ? baseListUrl
                : `${baseListUrl}/${props.devis.id}`
            }
            className="text-sm text-ink/50 hover:text-ink"
          >
            {t.common.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-ink/60"}>
        {label}
      </span>
      <span
        className={
          bold ? "text-base font-semibold text-ink" : "text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
