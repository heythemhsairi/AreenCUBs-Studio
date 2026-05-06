import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const USERNAME_DOMAIN =
  process.env.USERNAME_EMAIL_DOMAIN ?? "areencubs.studio";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.split("@")[0];
}

export type UserRole = "admin" | "worker" | "freelancer";

export const ROLES: UserRole[] = ["admin", "worker", "freelancer"];
