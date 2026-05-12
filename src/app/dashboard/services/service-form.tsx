"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
} from "./actions";

type Service = {
  id: string;
  name_fr: string;
  name_en: string | null;
  description_fr: string | null;
  category: string | null;
  default_price_dt: number;
  default_unit: string;
  active: boolean;
};

type Props =
  | { mode: "create"; service?: undefined }
  | { mode: "edit"; service: Service };

export function ServiceForm(props: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [delPending, startDelete] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createServiceAction(fd)
          : await updateServiceAction(fd);
      if (res && !res.ok) setError(res.error);
      else if (res?.ok) setSaved(true);
    });
  }

  function onDelete() {
    if (props.mode !== "edit") return;
    if (!confirm("Supprimer ce service ?")) return;
    const fd = new FormData();
    fd.set("id", props.service.id);
    startDelete(async () => {
      await deleteServiceAction(fd);
    });
  }

  const s = props.mode === "edit" ? props.service : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          props.mode === "create"
            ? "Nouveau service"
            : (s?.name_fr ?? "Service")
        }
        subtitle={
          <Link href="/dashboard/services" className="hover:underline">
            ← Catalogue
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {props.mode === "create" ? "Créer" : "Modifier"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {props.mode === "edit" && (
              <input type="hidden" name="id" value={s?.id} />
            )}

            <Field label="Nom (FR)">
              <Input name="name_fr" required defaultValue={s?.name_fr ?? ""} />
            </Field>
            <Field label="Nom (EN, optionnel)">
              <Input name="name_en" defaultValue={s?.name_en ?? ""} />
            </Field>
            <Field label="Description (FR)">
              <Textarea
                name="description_fr"
                rows={2}
                defaultValue={s?.description_fr ?? ""}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Catégorie">
                <Input
                  name="category"
                  defaultValue={s?.category ?? ""}
                  placeholder="Branding…"
                />
              </Field>
              <Field label="Prix (DT)">
                <Input
                  name="default_price_dt"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={s?.default_price_dt ?? 0}
                  required
                />
              </Field>
              <Field label="Unité">
                <Input
                  name="default_unit"
                  defaultValue={s?.default_unit ?? "unit"}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                name="active"
                defaultChecked={s?.active ?? true}
                className="h-4 w-4 rounded border-ink/30 accent-brand"
              />
              Actif (affiché dans le sélecteur de devis)
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-green-700">Enregistré ✓</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Enregistrement…"
                  : props.mode === "create"
                    ? "Créer"
                    : "Enregistrer"}
              </Button>
              <Link
                href="/dashboard/services"
                className="text-sm text-ink/55 hover:text-ink"
              >
                Annuler
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {props.mode === "edit" && (
        <Card className="max-w-2xl border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Supprimer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink/70">
              Les devis existants conservent leur référence (lien défini sur
              null).
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
              onClick={onDelete}
              disabled={delPending}
            >
              {delPending ? "Suppression…" : "Supprimer"}
            </Button>
          </CardContent>
        </Card>
      )}
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
      <label className="text-xs font-semibold uppercase tracking-wider text-ink/55">
        {label}
      </label>
      {children}
    </div>
  );
}
