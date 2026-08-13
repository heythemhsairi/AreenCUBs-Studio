import type { Locale } from "@/lib/i18n/dictionary";
import type { UserRole } from "@/lib/utils";

type InternalRole = Exclude<UserRole, "client">;
type RoleCopy = {
  open: string;
  done: string;
  collaboration: string;
  assigned: (title: string) => string;
};

const fr = {
  admin: {
    open: "Vous donnez le cap. Prenez un instant pour clarifier la prochaine étape — l'équipe avance mieux grâce à vous.",
    done: "Mission accomplie 🎉 Merci de faire avancer tout le studio avec constance.",
    collaboration: "Votre clarté donne confiance à l'équipe. Partagez le contexte, célébrez les avancées et gardons tout le monde aligné.",
    assigned: (title: string) => `Nouvelle priorité : ${title}. Votre vision aide l'équipe à rester alignée 💙`,
  },
  worker: {
    open: "Votre savoir-faire fait la différence. Avancez à votre rythme, une étape solide après l'autre.",
    done: "Excellent travail 🎉 Une mission de plus livrée avec soin. Toute l'équipe apprécie votre contribution.",
    collaboration: "Votre expérience compte. Partagez une idée, demandez un coup de main ou gardez simplement l'équipe au courant.",
    assigned: (title: string) => `Une nouvelle mission vous attend : ${title}. Toute l'équipe compte sur votre talent 💙`,
  },
  freelancer: {
    open: "Heureux de vous avoir avec nous. Votre regard et votre talent apportent une vraie valeur à cette mission.",
    done: "Bravo 🎉 Votre contribution compte vraiment. Merci pour cette belle livraison.",
    collaboration: "Vous faites partie de l'équipe. Cet espace est là pour échanger simplement et rester proche du projet.",
    assigned: (title: string) => `Une nouvelle collaboration pour vous : ${title}. Votre talent fait la différence ✨`,
  },
  commercial: {
    open: "Chaque suivi construit une relation plus forte. Merci de représenter le studio avec attention.",
    done: "Très belle avancée 🎉 Merci de transformer les échanges en confiance durable.",
    collaboration: "Votre contexte client est précieux. Partagez-le ici pour aider chacun à répondre avec justesse.",
    assigned: (title: string) => `Un nouveau suivi pour vous : ${title}. Votre sens du contact est précieux 🤝`,
  },
  intern: {
    open: "Chaque tâche est une occasion d'apprendre. Posez des questions, prenez votre temps et soyez fier de vos progrès.",
    done: "Bravo 🎉 Vous progressez à chaque mission. L'équipe voit et apprécie vos efforts.",
    collaboration: "Aucune question n'est trop petite. Écrivez, mentionnez la bonne personne et apprenez avec l'équipe.",
    assigned: (title: string) => `Une nouvelle occasion d'apprendre : ${title}. L'équipe est là pour vous accompagner 🌱`,
  },
} satisfies Record<InternalRole, RoleCopy>;

const en = {
  admin: {
    open: "You set the direction. Take a moment to clarify the next step — the team moves better with your guidance.",
    done: "Mission accomplished 🎉 Thank you for moving the whole studio forward with consistency.",
    collaboration: "Your clarity gives the team confidence. Share context, celebrate progress, and keep everyone aligned.",
    assigned: (title: string) => `New priority: ${title}. Your vision keeps the team aligned 💙`,
  },
  worker: {
    open: "Your craft makes a difference. Move at a steady pace, one solid step at a time.",
    done: "Excellent work 🎉 Another mission delivered with care. The whole team values your contribution.",
    collaboration: "Your experience matters. Share an idea, ask for help, or simply keep the team in the loop.",
    assigned: (title: string) => `A new mission is ready for you: ${title}. The team is counting on your talent 💙`,
  },
  freelancer: {
    open: "We're glad to have you with us. Your perspective and talent bring real value to this mission.",
    done: "Well done 🎉 Your contribution truly matters. Thank you for a great delivery.",
    collaboration: "You are part of the team. This space keeps conversations simple and everyone close to the project.",
    assigned: (title: string) => `A new collaboration for you: ${title}. Your talent makes the difference ✨`,
  },
  commercial: {
    open: "Every follow-up builds a stronger relationship. Thank you for representing the studio with care.",
    done: "Great progress 🎉 Thank you for turning conversations into lasting trust.",
    collaboration: "Your client context is valuable. Share it here so everyone can respond thoughtfully.",
    assigned: (title: string) => `A new follow-up for you: ${title}. Your people skills are invaluable 🤝`,
  },
  intern: {
    open: "Every task is a chance to learn. Ask questions, take your time, and be proud of your progress.",
    done: "Well done 🎉 You grow with every mission. The team sees and appreciates your effort.",
    collaboration: "No question is too small. Write, mention the right person, and learn with the team.",
    assigned: (title: string) => `A new chance to learn: ${title}. The team is here to support you 🌱`,
  },
} satisfies Record<InternalRole, RoleCopy>;

function copyFor(role: UserRole, locale: Locale = "fr") {
  const internalRole: InternalRole = role === "client" ? "worker" : role;
  return (locale === "en" ? en : fr)[internalRole];
}

export function taskOpenMessage(role: UserRole, locale: Locale = "fr") {
  return copyFor(role, locale).open;
}

export function taskDoneMessage(role: UserRole, locale: Locale = "fr") {
  return copyFor(role, locale).done;
}

export function taskAssignedMessage(role: UserRole, title: string, locale: Locale = "fr") {
  return copyFor(role, locale).assigned(title);
}

export function collaborationWelcome(role: UserRole, locale: Locale = "fr") {
  return copyFor(role, locale).collaboration;
}
