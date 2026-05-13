"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "@/components/toast";
import { useI18n } from "@/lib/i18n/provider";
import { updateSettingsAction } from "./actions";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSettingsAction(fd);
      if (res.ok) toast.success(t.settings.saved);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.subtitle}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.identity}</CardTitle>
            <p className="text-xs text-ink/55">{t.settings.identityHint}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.settings.companyName}>
                <Input
                  name="company_name"
                  defaultValue={initial.company_name}
                  required
                />
              </Field>
              <Field label={t.settings.fiscalId}>
                <Input
                  name="matricule_fiscal"
                  defaultValue={initial.matricule_fiscal}
                />
              </Field>
              <Field label={t.settings.email} full>
                <Input
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                />
              </Field>
              <Field label={t.settings.phone}>
                <Input name="phone" defaultValue={initial.phone} />
              </Field>
              <Field label={t.settings.website}>
                <Input name="website" defaultValue={initial.website} />
              </Field>
              <Field label={t.settings.address} full>
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
            <CardTitle>{t.settings.bank}</CardTitle>
            <p className="text-xs text-ink/55">{t.settings.bankHint}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.settings.bankName}>
                <Input
                  name="bank_name"
                  defaultValue={initial.bank_name ?? ""}
                  placeholder={t.settings.bankPlaceholder}
                />
              </Field>
              <Field label={t.settings.rib}>
                <Input
                  name="bank_rib"
                  defaultValue={initial.bank_rib ?? ""}
                  placeholder={t.settings.ribPlaceholder}
                />
              </Field>
              <Field label={t.settings.iban} full>
                <Input
                  name="bank_iban"
                  defaultValue={initial.bank_iban ?? ""}
                  placeholder={t.settings.ibanPlaceholder}
                />
              </Field>
              <Field label={t.settings.paymentTerms} full>
                <Input
                  name="payment_terms"
                  defaultValue={initial.payment_terms ?? ""}
                  placeholder={t.settings.paymentTermsPlaceholder}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.settings.defaults}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.settings.vat}>
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
              <Field label={t.settings.devisObject} full>
                <Input
                  name="default_devis_object"
                  defaultValue={initial.default_devis_object}
                />
              </Field>
              <Field label={t.settings.factureObject} full>
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
            {pending ? t.common.saving : t.common.save}
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
