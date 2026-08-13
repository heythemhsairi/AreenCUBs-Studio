export const STUDIO_SECTIONS = [
  { path: "/dashboard", labelFr: "Aperçu", labelEn: "Overview" },
  { path: "/dashboard/tasks", labelFr: "Tâches clients", labelEn: "Client tasks" },
  { path: "/dashboard/studio-tasks", labelFr: "Tâches Areen", labelEn: "Areen tasks" },
  { path: "/dashboard/calendar", labelFr: "Calendrier", labelEn: "Calendar" },
  { path: "/dashboard/content", labelFr: "Content OS", labelEn: "Content OS" },
  { path: "/dashboard/review", labelFr: "Révision vidéo", labelEn: "Video review" },
  { path: "/dashboard/team/workload", labelFr: "Charge équipe", labelEn: "Team workload" },
  { path: "/dashboard/team/planning", labelFr: "Planning", labelEn: "Planning" },
  { path: "/dashboard/payroll", labelFr: "Points & salaires", labelEn: "Points & payroll" },
] as const;

export function findStudioSection(path: string | null | undefined) {
  return STUDIO_SECTIONS.find((section) => section.path === path) ?? null;
}
