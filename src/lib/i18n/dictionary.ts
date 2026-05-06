export type Locale = "fr" | "en";

export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

export const dict = {
  fr: {
    appName: "Areen CUBs Studio",
    tagline: "Espace interne de gestion",
    login: {
      title: "Connexion",
      username: "Nom d'utilisateur",
      usernameHint: "Uniquement la partie avant @ (ex. heythem)",
      password: "Mot de passe",
      submit: "Se connecter",
      errorInvalid: "Identifiants invalides.",
      errorGeneric: "Connexion impossible. Réessayez.",
      noAccount:
        "Pas de compte ? Demandez à un admin (CEO/CTO/CMO) de créer le vôtre.",
    },
    nav: {
      dashboard: "Tableau de bord",
      logout: "Déconnexion",
    },
    roles: {
      admin: "Administrateur",
      worker: "Collaborateur",
      freelancer: "Freelance",
    },
    dashboard: {
      welcome: "Bienvenue",
      placeholder: "Bientôt : tâches, devis, et plus.",
      admin: {
        title: "Tableau de bord — Administrateur",
        kpis: {
          revenueMtd: "Chiffre d'affaires (mois)",
          outstanding: "En attente de paiement",
          activeProjects: "Projets actifs",
          activeTasks: "Tâches actives",
        },
      },
      worker: {
        title: "Tableau de bord — Collaborateur",
        intro: "Vos tâches et celles de l'équipe.",
      },
      freelancer: {
        title: "Tableau de bord — Freelance",
        intro: "Vos tâches assignées.",
      },
    },
  },
  en: {
    appName: "Areen CUBs Studio",
    tagline: "Internal management workspace",
    login: {
      title: "Sign in",
      username: "Username",
      usernameHint: "Just the part before @ (e.g. heythem)",
      password: "Password",
      submit: "Sign in",
      errorInvalid: "Invalid credentials.",
      errorGeneric: "Sign-in failed. Please try again.",
      noAccount:
        "No account? Ask an admin (CEO/CTO/CMO) to create one for you.",
    },
    nav: {
      dashboard: "Dashboard",
      logout: "Sign out",
    },
    roles: {
      admin: "Administrator",
      worker: "Team member",
      freelancer: "Freelancer",
    },
    dashboard: {
      welcome: "Welcome",
      placeholder: "Coming soon: tasks, quotes, and more.",
      admin: {
        title: "Admin dashboard",
        kpis: {
          revenueMtd: "Revenue (MTD)",
          outstanding: "Outstanding",
          activeProjects: "Active projects",
          activeTasks: "Active tasks",
        },
      },
      worker: {
        title: "Team dashboard",
        intro: "Your tasks and the team's.",
      },
      freelancer: {
        title: "Freelancer dashboard",
        intro: "Your assigned tasks.",
      },
    },
  },
} as const;

export type Dict = (typeof dict)[Locale];
