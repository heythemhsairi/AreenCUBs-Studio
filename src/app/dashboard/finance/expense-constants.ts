export const EXPENSE_CATEGORIES = [
  { value: "salaries",    label: "Salaires" },
  { value: "freelancers", label: "Freelances" },
  { value: "ads",         label: "Publicité" },
  { value: "software",    label: "Logiciels" },
  { value: "hosting",     label: "Hébergement" },
  { value: "transport",   label: "Transport" },
  { value: "office",      label: "Bureau" },
  { value: "production",  label: "Production client" },
  { value: "other",       label: "Autre" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
