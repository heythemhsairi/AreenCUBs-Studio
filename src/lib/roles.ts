import type { Tone } from "@/components/ui/badge";
import { INTERNAL_ROLES, type UserRole } from "@/lib/utils";

/**
 * How each role is presented. One source, deliberately.
 *
 * Adding `commercial`, `intern` and `client` to the union broke four separate
 * `Record<UserRole, …>` literals — the profile page, the team list, the team
 * planning page and the topbar — each holding its own copy of the same three
 * mappings. TypeScript caught every one, which is the argument for the
 * exhaustive Record; four copies of it is the argument for this file.
 *
 * Tones come from the Badge palette and were all contrast-corrected in Phase 1,
 * so each carries a readable label in both themes.
 */
export const ROLE_TONE: Record<UserRole, Tone> = {
  admin: "violet",
  worker: "blue",
  freelancer: "green",
  commercial: "amber",
  intern: "cyan",
  // A client contact is external. Neutral on purpose: they are not a member of
  // the team, and colouring them like one would suggest otherwise.
  client: "slate",
};

/**
 * The roles that appear in team surfaces.
 *
 * A client contact holds a profile row, so any unfiltered listing of profiles
 * would show an external person among the agency's staff. Team views filter on
 * this; they are about employees, not about everyone who can sign in.
 */
export const TEAM_ROLES: UserRole[] = INTERNAL_ROLES;

/** French fallback labels for server components without an i18n context. */
export const ROLE_LABEL_FR: Record<UserRole, string> = {
  admin: "Administrateur",
  worker: "Collaborateur",
  freelancer: "Freelance",
  commercial: "Commercial",
  intern: "Stagiaire",
  client: "Client",
};
