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
  default_price_dt: number;
  default_unit: string;
  category: string | null;
};

type Client = { id: string; name: string };

type LineItem = {
  key: string; // local-only for React keys
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
  items: Array<{
    service_id: string | null;
    description: string;
    quantity: number;
    unit_price_dt: number;
    is_bonus: boolean;
  }>;
};

type Props =
  | {
      mode: "create";
      defaultClientId?: string;
      clients: Client[];
      services: Service[];
      devis?: undefined;
    }
  | {
      mode: "edit";
      devis: Devis;
      clients: Client[];
      services: Service[];
      defaultClientId?: undefined;
    };

const TVA_RATE = 19;
const todayIso = () => new Date().toISOString().slice(0, 10);
const plus14Iso = () =>
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let keyCounter = 0;
const nextKey = () => `row-${++keyCounter}`;

export function DevisBuilder(props: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      : "Création d'identité visuelle et supports de communication",
  );
  const [notes, setNotes] = useState(
    props.mode === "edit" ? (props.devis.notes ?? "") : "",
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
    const tva = +((subtotal * TVA_RATE) / 100).toFixed(2);
    const total = +(subtotal + tva).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), tva, total };
  }, [items]);

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

  function applyService(rowKey: string, serviceId: string) {
    const svc = props.services.find((s) => s.id === serviceId);
    if (!svc) return;
    updateRow(rowKey, {
      service_id: svc.id,
      description: svc.name_fr,
      unit_price_dt: Number(svc.default_price_dt),
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (props.mode === "edit") fd.set("id", props.devis.id);
    fd.set("client_id", clientId);
    fd.set("date", date);
    fd.set("due_date", dueDate);
    fd.set("object", object);
    fd.set("notes", notes);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={props.mode === "create" ? "Nouveau devis" : "Modifier le devis"}
        subtitle={
          <Link href="/dashboard/devis" className="hover:underline">
            ← Devis
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Client">
                <Select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {props.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Objet">
                <Input
                  value={object}
                  onChange={(e) => setObject(e.target.value)}
                  placeholder="Création d'identité visuelle…"
                />
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Échéance">
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
            <CardTitle>Lignes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
              <div className="col-span-5">Description</div>
              <div className="col-span-2">P.U. (DT)</div>
              <div className="col-span-1">Qté</div>
              <div className="col-span-2 text-right">Total ligne</div>
              <div className="col-span-1 text-center">Bonus</div>
              <div className="col-span-1" />
            </div>

            {items.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-12 md:items-center md:border-0 md:bg-transparent md:p-0"
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
                    <option value="">— Service catalogue —</option>
                    {props.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name_fr} ({s.default_price_dt} DT)
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Description"
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
                <div className="font-medium text-slate-700 md:col-span-2 md:text-right">
                  {item.is_bonus
                    ? "Bonus"
                    : formatDt(item.quantity * (item.unit_price_dt || 0))}
                </div>
                <label className="flex items-center justify-center gap-1.5 text-xs text-slate-600 md:col-span-1">
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
                  Bonus
                </label>
                <div className="md:col-span-1 md:text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(item.key)}
                    className="text-xs text-red-600 hover:underline"
                    title="Supprimer la ligne"
                  >
                    × Supprimer
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
              + Ajouter une ligne
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              <Row label="Sous total" value={formatDt(totals.subtotal)} />
              <Row label="TVA (19%)" value={formatDt(totals.tva)} />
              <div className="border-t border-slate-200 pt-2">
                <Row
                  label="Total TTC"
                  value={formatDt(totals.total)}
                  bold
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes (internes — non imprimées)</CardTitle>
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
                ? "Créer le devis"
                : t.common.save}
          </Button>
          <Link
            href={
              props.mode === "create"
                ? "/dashboard/devis"
                : `/dashboard/devis/${props.devis.id}`
            }
            className="text-sm text-slate-500 hover:text-slate-800"
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
      <label className="text-sm font-medium text-slate-700">{label}</label>
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
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
      </span>
      <span
        className={
          bold ? "text-base font-semibold text-slate-900" : "text-slate-800"
        }
      >
        {value}
      </span>
    </div>
  );
}
