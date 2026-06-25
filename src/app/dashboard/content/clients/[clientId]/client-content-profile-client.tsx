"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import { upsertContentProfileAction, createContentPlanAction } from "../../actions";
import {
  ChevronLeft, Plus, CheckCircle2, Clock, Layers, ExternalLink,
} from "lucide-react";

type Client = { id: string; name: string; email: string | null };
type ContentItem = { id: string; status: string; content_type: string; platform: string };
type Plan = {
  id: string;
  month: number;
  year: number;
  theme: string | null;
  status: string;
  goals: string | null;
  approved_at: string | null;
  created_at: string;
  content_items: ContentItem[];
};
type Profile = {
  client_id: string;
  brand_voice: string | null;
  industry: string | null;
  target_audience: string | null;
  services: string | null;
  platforms: string[];
  monthly_goal: string | null;
  posting_frequency: string | null;
  content_pillars: string[];
  design_direction: string | null;
  forbidden_topics: string | null;
  competitors: string | null;
  notes: string | null;
} | null;
type Member = { id: string; full_name: string | null; username: string; avatar_url: string | null };

type Props = {
  client: Client;
  profile: Profile;
  plans: Plan[];
  members: Member[];
};

const PLATFORMS = ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube", "threads"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--c-border)] text-[var(--c-text-3)]",
  approved: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-[var(--c-border)] text-[var(--c-text-3)]",
};

export function ClientContentProfileClient({ client, profile, plans, members: _members }: Props) {
  const { t } = useI18n();
  const c = t.contentOS;
  const monthNames = c.months;

  const [tab, setTab] = useState<"profile" | "plans">("profile");
  const [editingProfile, setEditingProfile] = useState(!profile);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    profile?.platforms ?? [],
  );

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("client_id", client.id);
    selectedPlatforms.forEach((p) => formData.append("platforms", p));
    startTransition(async () => {
      const res = await upsertContentProfileAction(formData);
      if (res.ok) {
        toast.success(c.profileSaved);
        setEditingProfile(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  function handleCreatePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("client_id", client.id);
    startTransition(async () => {
      const res = await createContentPlanAction(formData);
      if (res.ok) {
        toast.success(c.planCreated);
        setShowNewPlan(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)]">
        <Link href="/dashboard/content" className="hover:text-[var(--c-text-1)] flex items-center gap-1 transition-colors">
          <ChevronLeft size={14} />
          {c.title}
        </Link>
        <span>/</span>
        <span className="text-[var(--c-text-1)] font-medium">{client.name}</span>
      </div>

      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--c-text-1)]">{client.name}</h1>
          {client.email && <p className="text-sm text-[var(--c-text-3)]">{client.email}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/content/calendar?client=${client.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-elevated)] transition-colors"
          >
            <ExternalLink size={13} />
            {c.calendar}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--c-border)]">
        {(["profile", "plans"] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === tabKey
                ? "border-[#22D3EE] text-[#22D3EE]"
                : "border-transparent text-[var(--c-text-3)] hover:text-[var(--c-text-1)]",
            )}
          >
            {tabKey === "profile" ? c.clientProfile : c.monthlyPlans}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
            <h2 className="font-semibold text-[var(--c-text-1)]">{c.clientProfile}</h2>
            {!editingProfile && (
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="text-sm text-[#22D3EE] hover:text-[#22D3EE]/80 transition-colors"
              >
                {c.editProfile}
              </button>
            )}
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="p-5 flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={c.profileFields.brandVoice}>
                  <textarea
                    name="brand_voice"
                    defaultValue={profile?.brand_voice ?? ""}
                    placeholder={c.profilePlaceholders.brandVoice}
                    rows={2}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.industry}>
                  <input
                    name="industry"
                    defaultValue={profile?.industry ?? ""}
                    placeholder={c.profilePlaceholders.industry}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.targetAudience}>
                  <textarea
                    name="target_audience"
                    defaultValue={profile?.target_audience ?? ""}
                    placeholder={c.profilePlaceholders.targetAudience}
                    rows={2}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.services}>
                  <textarea
                    name="services"
                    defaultValue={profile?.services ?? ""}
                    placeholder={c.profilePlaceholders.services}
                    rows={2}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.monthlyGoal}>
                  <input
                    name="monthly_goal"
                    defaultValue={profile?.monthly_goal ?? ""}
                    placeholder={c.profilePlaceholders.monthlyGoal}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.postingFrequency}>
                  <input
                    name="posting_frequency"
                    defaultValue={profile?.posting_frequency ?? ""}
                    placeholder={c.profilePlaceholders.postingFrequency}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.contentPillars} className="sm:col-span-2">
                  <textarea
                    name="content_pillars"
                    defaultValue={(profile?.content_pillars ?? []).join("\n")}
                    placeholder={c.profilePlaceholders.contentPillars}
                    rows={3}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.designDirection} className="sm:col-span-2">
                  <input
                    name="design_direction"
                    defaultValue={profile?.design_direction ?? ""}
                    placeholder={c.profilePlaceholders.designDirection}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.forbiddenTopics}>
                  <input
                    name="forbidden_topics"
                    defaultValue={profile?.forbidden_topics ?? ""}
                    placeholder={c.profilePlaceholders.forbiddenTopics}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.competitors}>
                  <input
                    name="competitors"
                    defaultValue={profile?.competitors ?? ""}
                    placeholder={c.profilePlaceholders.competitors}
                    className="input-base"
                  />
                </Field>
                <Field label={c.profileFields.notes} className="sm:col-span-2">
                  <textarea
                    name="notes"
                    defaultValue={profile?.notes ?? ""}
                    placeholder={c.profilePlaceholders.notes}
                    rows={2}
                    className="input-base"
                  />
                </Field>
              </div>

              {/* Platforms */}
              <Field label={c.profileFields.platforms}>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all capitalize",
                        selectedPlatforms.includes(p)
                          ? "bg-[#22D3EE] text-[#071B2C]"
                          : "bg-[var(--c-elevated)] text-[var(--c-text-2)] hover:bg-[var(--c-border)]",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex gap-2 justify-end">
                {profile && (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#071B2C] hover:bg-[#22D3EE]/90 disabled:opacity-60 transition-colors"
                >
                  {isPending ? t.common.saving : c.saveProfile}
                </button>
              </div>
            </form>
          ) : profile ? (
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <ProfileRow label={c.profileFields.brandVoice} value={profile.brand_voice} />
              <ProfileRow label={c.profileFields.industry} value={profile.industry} />
              <ProfileRow label={c.profileFields.targetAudience} value={profile.target_audience} />
              <ProfileRow label={c.profileFields.services} value={profile.services} />
              <ProfileRow label={c.profileFields.monthlyGoal} value={profile.monthly_goal} />
              <ProfileRow label={c.profileFields.postingFrequency} value={profile.posting_frequency} />
              {profile.content_pillars.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-[var(--c-text-3)]">{c.profileFields.contentPillars}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.content_pillars.map((p) => (
                      <span key={p} className="rounded-md bg-[#A78BFA]/15 px-2 py-0.5 text-xs font-medium text-[#A78BFA]">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.platforms.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-[var(--c-text-3)]">{c.profileFields.platforms}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.platforms.map((p) => (
                      <span key={p} className="rounded-md bg-[#22D3EE]/10 px-2 py-0.5 text-xs font-medium text-[#22D3EE] capitalize">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              <ProfileRow label={c.profileFields.designDirection} value={profile.design_direction} />
              <ProfileRow label={c.profileFields.forbiddenTopics} value={profile.forbidden_topics} />
              <ProfileRow label={c.profileFields.competitors} value={profile.competitors} />
              {profile.notes && <ProfileRow label={c.profileFields.notes} value={profile.notes} className="sm:col-span-2" />}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--c-text-3)]">
              {c.noProfileYet}
            </div>
          )}
        </div>
      )}

      {/* Plans tab */}
      {tab === "plans" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--c-text-1)]">
              {c.monthlyPlans}
            </h2>
            <button
              type="button"
              onClick={() => setShowNewPlan(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] px-3 py-2 text-sm font-medium hover:bg-[#22D3EE]/20 transition-colors"
            >
              <Plus size={14} />
              {c.newPlan}
            </button>
          </div>

          {/* New plan form */}
          {showNewPlan && (
            <form
              onSubmit={handleCreatePlan}
              className="rounded-xl border border-[#22D3EE]/30 bg-[var(--c-card)] p-4 flex flex-col gap-4"
            >
              <h3 className="font-semibold text-sm text-[var(--c-text-1)]">
                {c.newPlan}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={c.planFields.month}>
                  <select name="month" defaultValue={currentMonth} className="input-base">
                    {monthNames.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label={c.planFields.year}>
                  <select name="year" defaultValue={currentYear} className="input-base">
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </Field>
                <Field label={c.planFields.theme}>
                  <input
                    name="theme"
                    placeholder={c.planFieldPlaceholders.theme}
                    className="input-base"
                  />
                </Field>
              </div>
              <Field label={c.planFields.goals} className="">
                <textarea
                  name="goals"
                  placeholder={c.planFieldPlaceholders.goals}
                  rows={2}
                  className="input-base"
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewPlan(false)}
                  className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#071B2C] hover:bg-[#22D3EE]/90 disabled:opacity-60 transition-colors"
                >
                  {isPending ? t.common.saving : t.common.create}
                </button>
              </div>
            </form>
          )}

          {plans.length === 0 && !showNewPlan ? (
            <div className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-card)] py-12 text-center">
              <p className="text-sm text-[var(--c-text-3)]">{c.noPlans}</p>
              <button
                type="button"
                onClick={() => setShowNewPlan(true)}
                className="mt-3 text-sm text-[#22D3EE] hover:underline"
              >
                {c.createFirstPlan}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {plans.map((plan) => {
                const total = plan.content_items.length;
                const published = plan.content_items.filter((i) => i.status === "published").length;
                const approved = plan.content_items.filter((i) => i.status === "approved").length;
                const pct = total > 0 ? Math.round((published / total) * 100) : 0;

                return (
                  <Link
                    key={plan.id}
                    href={`/dashboard/content/plans/${plan.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 hover:border-[#22D3EE]/40 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--c-text-1)] group-hover:text-[#22D3EE] transition-colors">
                          {monthNames[plan.month - 1]} {plan.year}
                        </span>
                        {plan.theme && (
                          <span className="text-sm text-[var(--c-text-3)]">— {plan.theme}</span>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[plan.status] ?? STATUS_COLORS.draft)}>
                          {c.planStatus[plan.status as keyof typeof c.planStatus] ?? plan.status}
                        </span>
                      </div>
                      {plan.goals && (
                        <p className="mt-1 text-xs text-[var(--c-text-3)] line-clamp-1">{plan.goals}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--c-text-3)] shrink-0">
                      <span className="flex items-center gap-1">
                        <Layers size={11} />
                        {c.statsItems(total)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-400" />
                        {c.statsApproved(approved)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {pct}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-[var(--c-text-3)]">{label}</span>
      {children}
    </label>
  );
}

function ProfileRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs font-medium text-[var(--c-text-3)]">{label}</span>
      <span className="text-sm text-[var(--c-text-1)] whitespace-pre-line">{value}</span>
    </div>
  );
}
