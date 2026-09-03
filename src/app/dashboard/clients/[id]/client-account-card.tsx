"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClientContactAction } from "../actions";

export function ClientAccountCard({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: { id: string; username: string; fullName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(false);
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createClientContactAction(data);
      if (!result.ok) setError(result.error);
      else {
        setCreated(true);
        form.reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accès espace client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.length > 0 && (
          <ul className="space-y-2 text-sm">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded-lg border border-line px-3 py-2">
                <span className="font-medium text-content">{contact.fullName}</span>
                <span className="ml-2 text-content-3">@{contact.username}</span>
              </li>
            ))}
          </ul>
        )}

        <form className="space-y-3 border-t border-line pt-4" onSubmit={submit}>
          <input type="hidden" name="client_id" value={clientId} />
          <label className="block space-y-1.5 text-sm font-medium text-content-3">
            Nom complet
            <Input name="full_name" required placeholder="Contact WejdenSpire" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-content-3">
            Nom d’utilisateur
            <Input name="username" required autoCapitalize="none" placeholder="wejdenspire" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-content-3">
            Mot de passe temporaire
            <Input name="password" type="text" required minLength={8} autoComplete="new-password" />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {created && <p className="text-sm text-success">Compte client créé.</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Création…" : "Créer le compte client"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
