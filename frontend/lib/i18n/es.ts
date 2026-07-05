// Spanish translations for FLOWFIC.
//
// `satisfies Translations` (bottom of the file) makes drift a compile error in
// BOTH directions: a key missing here or an extra key not present in en.ts
// fails `tsc`, instead of silently shipping a stale dictionary.

import type { Translations } from "./en"

export const es = {
  app: {
    title: "Flowfic",
    tagline: "Un juego de escritura. No pares las manos.",
  },

  welcome: {
    dontShowAgain: "No mostrar de nuevo",
    start: "Entendido",
    next: "Siguiente",
    back: "Atrás",
    skipTutorial: "Saltar tutorial",
    stepLabel: "Paso {current} de {total}",
    goToStep: "Ir al paso {n}",
    items: {
      intro: {
        title: "Bienvenido a FLOWFIC",
        body: "Un juego de escritura donde tus manos no paran. Reglas rápidas antes de empezar.",
      },
      pickVelocity: {
        title: "Elige tu velocidad",
        body: "Elige un preset o ajusta los temporizadores en la próxima pantalla.",
      },
      createStory: {
        title: "Escribe sin parar",
        body: "Sigue escribiendo en el área principal. Si te quedas inactivo demasiado, se acaba.",
      },
      requiredWords: {
        title: "Palabras requeridas",
        body: "Aparecen palabras mientras escribes. Úsalas o déjalas desaparecer. Activa el plazo para penalizar las no usadas.",
      },
      shareSave: {
        title: "Revisa y pule",
        body: "Al terminar verás tus estadísticas; después vuelves a la historia para editarla o copiarla.",
      },
    },
  },

  settings: {
    title: "Configuración de sesión",
    description: "Elige un preset o ajusta abajo.",
    presetsLabel: "Ajustes rápidos",
    mainTimerLabel: "Tiempo de inactividad",
    mainTimerHelp: "Segundos inactivo antes de terminar.",
    globalTimerLabel: "Duración de la sesión",
    globalTimerHelp: "Duración total. Desactiva para sesión sin límite.",
    globalTimerEnable: "Limitar duración de sesión",
    requiredWordIntervalEnable: "Activar palabras requeridas",
    requiredWordIntervalLabel: "Nueva palabra requerida cada",
    requiredWordIntervalHelp: "Intervalo promedio entre palabras; aleatorio.",
    requiredWordUseTimerLabel: "Tiempo para usar la palabra requerida",
    requiredWordUseTimerHelp:
      "Activado: las palabras no usadas terminan la sesión. Desactivado: desaparecen tras unos segundos.",
    requiredWordUseTimerEnable: "Imponer límite de tiempo para la palabra",
    bellLabel: "Campanillazo al aparecer una nueva palabra",
    categoryWordsLabel: "Categorías de palabras personalizadas",
    categoryWordsHelp:
      "Palabras semilla separadas por comas. Las requeridas vendrán de un grupo relacionado.",
    categoryWordsEnable: "Usar categorías personalizadas",
    categoryWordsPlaceholder: "cocina, comida, restaurantes",
    categoryWordsLoading: "Cargando palabras de la categoría…",
    categoryWordsError: "No se pudieron obtener palabras. Usando el grupo por defecto.",
    secondsSuffix: "s",
    minutesSuffix: "m",
    start: "Empezar a escribir",
    customModesLabel: "Modos personalizados",
    customModesDescription: "Tus presets guardados. Haz clic para aplicar.",
    customModesTooltip: "Edita o elimina tus modos personalizados desde tu perfil.",
    backToPresetsLabel: "Volver a los presets originales",
    backToPresetsDescription: "Mostrar los modos predeterminados.",
    createPresetLabel: "Guardar configuración actual",
    createPresetTooltip: "Guarda los ajustes de arriba como un modo personalizado.",
    customNamePlaceholder: "Nombre del modo",
    customNameSave: "Guardar",
    customNameCancel: "Cancelar",
    customLimitReached: "Puedes tener como máximo {max} modos personalizados.",
    customEmptySlot: "Hueco vacío",
    customSaveFailed: "No se pudo guardar el modo personalizado.",
    signInForCustomModes: "Inicia sesión para guardar modos personalizados.",
  },

  presets: {
    classic: {
      name: "Clásico",
      description: "Ajustes equilibrados para una sesión de 5 minutos.",
    },
    speed: {
      name: "Velocidad",
      description: "Poco tiempo inactivo y palabras rápidas. No pares.",
    },
    relaxed: {
      name: "Relajado",
      description: "Sin temporizador global, palabras lentas y plazos suaves.",
    },
    creative: {
      name: "Demasiado creativo",
      description: "Las palabras requeridas llegan sin parar. Mantente ágil.",
    },
    nolimit: {
      name: "Sin Límite",
      description: "Sin temporizador global, palabras lentas, juega cuanto quieras.",
    },
  },

  game: {
    requiredWordHeader: "Palabra requerida",
    noRequiredWord: "Sigue escribiendo…",
    useWordIn: "Úsala en",
    idleEndsIn: "Inactividad en",
    sessionEndsIn: "Sesión termina en",
    characters: "caracteres",
    placeholder: "Empieza tu historia. No dejes de escribir…",
    pause: "Abandonar",
    quit: "Salir de sesión",
    createStory: "Crear una historia",
    viewingStory: "Viendo una historia anterior (solo lectura).",
  },

  profile: {
    title: "Tu perfil",
    description: "Edita cómo aparecen tu nombre, correo y avatar en la app.",
    nameLabel: "Nombre",
    emailLabel: "Correo",
    emailInvalid: "Ingresa un correo válido.",
    uploadPicture: "Subir foto",
    removePicture: "Quitar foto",
    pictureTooLarge: "Elige una imagen menor a 256 KB.",
    pictureReadFailed: "No se pudo leer ese archivo.",
    storyCountLabel: "Historias escritas",
    save: "Guardar cambios",
    saving: "Guardando…",
    saved: "Guardado.",
    saveFailed: "No se pudieron guardar los cambios.",
    menuItem: "Perfil",
    customPresetEdit: "Renombrar",
    customPresetDelete: "Eliminar",
    customPresetSave: "Guardar",
    customPresetCancel: "Cancelar",
    customPresetDeleteConfirm: "¿Eliminar este modo personalizado?",
    customPresetDeleteConfirmDescription:
      "Esto elimina el modo personalizado de forma permanente. Esta acción no se puede deshacer.",
    customPresetDeleteFailed: "No se pudo eliminar el modo personalizado.",
    customPresetRenameFailed: "No se pudo renombrar el modo personalizado.",
  },

  results: {
    title: "Sesión terminada",
    reasonIdle: "Dejaste de escribir demasiado tiempo.",
    reasonGlobal: "Tiempo agotado — alcanzaste el límite de sesión.",
    reasonUnusedWord: "No usaste la palabra requerida a tiempo.",
    reasonManual: "Terminaste la sesión.",
    duration: "Duración",
    characters: "Caracteres escritos",
    words: "Palabras",
    requiredWordsUsed: "Palabras requeridas usadas",
    close: "Seguir editando",
  },

  units: {
    seconds: "s",
    minutes: "m",
  },

  sidebar: {
    title: "Historias recientes",
    subtitle: "Tus últimas sesiones de escritura",
    empty: "Aún no hay historias — termina una sesión para verla aquí.",
    signUpPrompt: "Regístrate para ver tus historias guardadas aquí.",
    error: "No se pudieron cargar las historias.",
    toggle: "Abrir historias recientes",
    toggleShort: "Historias",
    durationLabel: "Duración de la sesión",
    rowMenuLabel: "Opciones de la historia",
    deleteStory: "Eliminar",
    deleteStoryConfirmTitle: "¿Eliminar esta historia?",
    deleteStoryConfirmDescription:
      "Esto elimina la historia permanentemente. Esta acción no se puede deshacer.",
    deleteStoryConfirm: "Eliminar",
    deleteStoryCancel: "Cancelar",
    deleteStoryFailed: "No se pudo eliminar la historia.",
  },

  prefs: {
    sectionLabel: "Preferencias",
    modeLabel: "Modo",
    modeLight: "Claro",
    modeDark: "Oscuro",
    languageLabel: "Idioma",
  },

  auth: {
    signedOut: "Iniciar sesión",
    signedIn: "Cuenta",
    logIn: "Iniciar sesión",
    logOut: "Cerrar sesión",
    title: "Inicia sesión en FLOWFIC",
    description:
      "Puedes jugar sin cuenta. Inicia sesión para guardar tus historias y acceder a tablas de líderes (próximamente).",
    continueWith: "Continuar con {provider}",
    google: "Google",
    facebook: "Facebook",
    twitter: "X (Twitter)",
    finishingSignIn: "Terminando el inicio de sesión…",
    signInFailed: "Falló el inicio de sesión.",
    signInFailedRetry: "Reintentar",
    backToGame: "Volver al juego",
    welcomeBack: "Bienvenido de vuelta, {name}",
    accountMenuLabel: "Menú de cuenta",
    profileEmail: "Correo",
    devUserLogin: "Inicio de sesión dev",
    devUsernameLabel: "Usuario de desarrollo",
    devUsernamePlaceholder: "usuario",
    devLoginSubmit: "Entrar como usuario dev",
    devUserNotFound: "No existe un usuario dev con ese nombre. Créalo primero.",
    devLoginFailed: "Falló el login de desarrollo. Asegúrate de que el backend esté corriendo.",
    providersDivider: "con un proveedor",
    emailInvalid: "Ingresa un correo válido.",
  },
} as const satisfies Translations
