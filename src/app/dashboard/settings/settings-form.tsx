"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "@/components/toast";
import { updateSettingsAction } from "./actions";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSettingsAction(fd);
      if (res.ok) toast.success("Paramètres enregistrés");
      else toast.error(res.error);
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
            <CardTitle>Coordonnées bancaires</CardTitle>
            <p className="text-xs text-ink/55">
              Imprimées en bas du devis pour faciliter le paiement.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Banque">
                <Input
                  name="bank_name"
                  defaultValue={initial.bank_name ?? ""}
                  placeholder="Ex. Banque de Tunisie"
                />
              </Field>
              <Field label="RIB">
                <Input
                  name="bank_rib"
                  defaultValue={initial.bank_rib ?? ""}
                  placeholder="20 chiffres"
                />
              </Field>
              <Field label="IBAN" full>
                <Input
                  name="bank_iban"
                  defaultValue={initial.bank_iban ?? ""}
                  placeholder="TN59 ..."
                />
              </Field>
              <Field label="Conditions de paiement" full>
                <Input
                  name="payment_terms"
                  defaultValue={initial.payment_terms ?? ""}
                  placeholder="Ex. Paiement à 30 jours"
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
