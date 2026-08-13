import { CheckCircle2, Mail, MessageCircle, Palette, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YOKO_ASSISTANT } from "@/lib/yoko-assistant";
import { cn } from "@/lib/utils";

const toneClasses = {
  success: "border-success/30 bg-success-weak text-success",
  warning: "border-warning/30 bg-warning-weak text-warning",
  neutral: "border-line bg-surface-2 text-content-2",
} as const;

export function YokoAssistantCard() {
  return (
    <Card className="max-w-3xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-brand via-accent to-brand" />
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand-weak text-brand">
            <Palette size={20} aria-hidden />
          </span>
          <div>
            <CardTitle>Personnalité & mode de travail</CardTitle>
            <p className="mt-1 text-sm leading-6 text-content-2">{YOKO_ASSISTANT.shortBio}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2" aria-label="Traits de personnalité">
          {YOKO_ASSISTANT.traits.map((trait) => (
            <span key={trait} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-content-2">
              {trait}
            </span>
          ))}
        </div>

        <section aria-labelledby="yoko-voice">
          <h3 id="yoko-voice" className="flex items-center gap-2 text-sm font-semibold text-content">
            <MessageCircle size={16} className="text-brand" aria-hidden />
            Sa voix
          </h3>
          <p className="mt-2 text-sm leading-6 text-content-2">{YOKO_ASSISTANT.voice}</p>
        </section>

        <section aria-labelledby="yoko-mission">
          <h3 id="yoko-mission" className="flex items-center gap-2 text-sm font-semibold text-content">
            <CheckCircle2 size={16} className="text-brand" aria-hidden />
            Sa mission
          </h3>
          <ul className="mt-2 grid gap-2 text-sm leading-6 text-content-2 sm:grid-cols-2">
            {YOKO_ASSISTANT.responsibilities.map((responsibility) => (
              <li key={responsibility} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>{responsibility}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="yoko-capabilities">
          <h3 id="yoko-capabilities" className="flex items-center gap-2 text-sm font-semibold text-content">
            <Mail size={16} className="text-brand" aria-hidden />
            Capacités
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {YOKO_ASSISTANT.capabilities.map((capability) => (
              <div key={capability.label} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-content">{capability.label}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", toneClasses[capability.tone])}>
                    {capability.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-content-3">{capability.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-brand/20 bg-brand-weak p-4" aria-labelledby="yoko-rules">
          <h3 id="yoko-rules" className="flex items-center gap-2 text-sm font-semibold text-content">
            <ShieldCheck size={16} className="text-brand" aria-hidden />
            Règles de confiance
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-content-2">
            {YOKO_ASSISTANT.operatingRules.map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
