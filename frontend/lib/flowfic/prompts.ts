// Curated writing prompts, one pool per locale. Kept out of the i18n
// dictionary on purpose: the `as const` dictionaries widen arrays into
// fixed-length tuples, which would force every locale to carry the exact same
// number of prompts. A plain record lets each language have its own pool.
//
// `dailyPromptIndex` (in gamification.ts) rotates through the pool by day so
// everyone sees the same prompt on a given date, and it changes at midnight.

import type { Locale } from "@/lib/i18n"

export const DAILY_PROMPTS: Record<Locale, string[]> = {
  en: [
    "A message found in a bottle changes the fate of everything.",
    "The last light in the city refuses to go out.",
    "Someone receives a letter from their future self.",
    "A door appears where there has never been one.",
    "The map was accurate — until yesterday.",
    "Two strangers keep meeting in the same dream.",
    "The machine finally learned to lie.",
    "On the morning the rain stopped, so did time.",
    "A stray key opens something it shouldn't.",
    "The town's clocks all strike thirteen at once.",
  ],
  es: [
    "Un mensaje encontrado en una botella cambia el destino de todo.",
    "La última luz de la ciudad se niega a apagarse.",
    "Alguien recibe una carta de su yo del futuro.",
    "Aparece una puerta donde nunca hubo una.",
    "El mapa era exacto… hasta ayer.",
    "Dos desconocidos se encuentran siempre en el mismo sueño.",
    "La máquina por fin aprendió a mentir.",
    "La mañana en que dejó de llover, también se detuvo el tiempo.",
    "Una llave perdida abre algo que no debería.",
    "Todos los relojes del pueblo dan las trece a la vez.",
  ],
}
