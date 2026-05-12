"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { formatDt } from "@/lib/format";
import { toggleServiceActiveAction } from "./actions";

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

export function ServicesList({ services }: { services: Service[] }) {
  if (services.length === 0) {
    return <EmptyState>Aucun service. Ajoutez le premier.</EmptyState>;
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Nom</TH>
          <TH>Catégorie</TH>
          <TH className="text-right">Prix (DT)</TH>
          <TH>Unité</TH>
          <TH>Actif</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {services.map((s) => (
          <Row key={s.id} svc={s} />
        ))}
      </TBody>
    </Table>
  );
}

function Row({ svc }: { svc: Service }) {
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    startTransition(async () => {
      await toggleServiceActiveAction(svc.id, next);
    });
  }

  return (
    <TR>
      <TD className="font-medium text-ink">
        <Link
          href={`/dashboard/services/${svc.id}`}
          className="hover:text-brand"
        >
          {svc.name_fr}
        </Link>
        {svc.description_fr && (
          <p className="mt-0.5 truncate text-xs text-ink/50">
            {svc.description_fr}
          </p>
        )}
      </TD>
      <TD className="text-ink/65">{svc.category ?? "—"}</TD>
      <TD className="text-right font-semibold text-ink">
        {formatDt(svc.default_price_dt)}
      </TD>
      <TD className="text-ink/65">{svc.default_unit}</TD>
      <TD>
        <button
          type="button"
          onClick={() => onToggle(!svc.active)}
          disabled={pending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            svc.active ? "bg-brand" : "bg-ink/15"
          } ${pending ? "opacity-60" : ""}`}
          aria-pressed={svc.active}
          aria-label={svc.active ? "Désactiver" : "Activer"}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              svc.active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </TD>
      <TD className="text-right">
        <Link
          href={`/dashboard/services/${svc.id}`}
          className="text-sm font-medium text-brand hover:text-brand-dark"
        >
          Modifier
        </Link>
      </TD>
    </TR>
  );
}
