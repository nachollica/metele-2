// Spanish translations for METELE.

export const es = {
  app: {
    title: "METELE",
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
        title: "Bienvenido a METELE",
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
    marathon: {
      name: "Maratón",
      description: "25 minutos de presión constante.",
    },
    chaos: {
      name: "Caos",
      description: "Inactividad brutal y palabras sin parar. Sobrevive si puedes.",
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
    startAgain: "Empezar de nuevo",
    closeStory: "Cerrar historia",
    viewingStory: "Viendo una historia anterior (solo lectura).",
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
    error: "No se pudieron cargar las historias.",
    toggle: "Abrir historias recientes",
    toggleShort: "Historias",
    durationLabel: "Duración de la sesión",
  },

  auth: {
    signedOut: "Iniciar sesión",
    signedIn: "Cuenta",
    logIn: "Iniciar sesión",
    logOut: "Cerrar sesión",
    signUp: "Crear cuenta",
    title: "Inicia sesión en METELE",
    description:
      "Puedes jugar sin cuenta. Inicia sesión para guardar tus historias y acceder a tablas de líderes (próximamente).",
    continueWith: "Continuar con {provider}",
    google: "Google",
    instagram: "Instagram",
    facebook: "Facebook",
    or: "o",
    tryMock: "Probar cuenta de prueba (dev)",
    cancel: "Quizá más tarde",
    finishingSignIn: "Terminando el inicio de sesión…",
    signInFailed: "Falló el inicio de sesión.",
    signInFailedRetry: "Reintentar",
    backToGame: "Volver al juego",
    welcomeBack: "Bienvenido de vuelta, {name}",
    accountMenuLabel: "Menú de cuenta",
    profileEmail: "Correo",
    profileProvider: "Sesión iniciada con {provider}",
  },
} as const
