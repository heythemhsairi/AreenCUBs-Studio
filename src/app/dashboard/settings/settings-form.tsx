"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { updateSettingsAction } from "./actions";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSettingsAction(fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        subtitle="Informations entreprise et défauts"
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identité de l&apos;entreprise</CardTitle>
            <p className="text-xs text-ink/55">
              Ces informations sont imprimées sur chaque devis et facture.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nom de l'entreprise">
                <Input
                  name="company_name"
                  defaultValue={initial.company_name}
                  required
                />
              </Field>
              <Field label="Matricule fiscal">
                <Input
                  name="matricule_fiscal"
                  defaultValue={initial.matricule_fiscal}
                />
              </Field>
              <Field label="Email" full>
                <Input
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                />
              </Field>
              <Field label="Téléphone">
                <Input name="phone" defaultValue={initial.phone} />
              </Field>
              <Field label="Site web">
                <Input name="website" defaultValue={initial.website} />
              </Field>
              <Field label="Adresse" full>
                <Textarea
                  name="company_address"
                  rows={3}
                  defaultValue={initial.company_address}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Défauts devis &amp; factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="TVA (%)">
                <Input
                  name="tva_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={initial.tva_rate}
                  required
                />
              </Field>
              <Field label="Objet par défaut — devis" full>
                <Input
                  name="default_devis_object"
                  defaultValue={initial.default_devis_object}
                />
              </Field>
              <Field label="Objet par défaut — facture" full>
                <Input
                  name="default_facture_object"
                  defaultValue={initial.default_facture_object}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-green-700">Paramètres enregistrés ✓</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wider text-ink/55">
        {label}
      </label>
      {children}
    </div>
  );
}
