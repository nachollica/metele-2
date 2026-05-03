// Spanish translations for METELE.

export const es = {
  app: {
    title: "METELE",
    tagline: "Un juego de escritura. No pares las manos.",
  },

  welcome: {
    title: "Bienvenido a METELE",
    description: "Unas reglas rápidas antes de empezar.",
    dontShowAgain: "No mostrar de nuevo",
    start: "Entendido, a escribir",
    items: {
      pickVelocity: {
        title: "Elige tu velocidad",
        body: "Selecciona un preset o ajusta los temporizadores en la siguiente pantalla.",
      },
      createStory: {
        title: "Crea tu historia",
        body: "Escribe sin parar en el área principal. Si te quedas inactivo demasiado, se acaba.",
      },
      requiredWords: {
        title: "Palabras requeridas",
        body: "Aparecen palabras que debes incluir en tu historia antes de que se agote el tiempo.",
      },
      noMistakes: {
        title: "No te preocupes por los errores",
        body: "No puedes borrar lo escrito. Corrige las erratas al final — sigue avanzando.",
      },
      shareSave: {
        title: "Comparte o guarda para después",
        body: "Al terminar puedes copiar tu historia, compartirla o guardarla para seguir editando.",
      },
    },
  },

  settings: {
    title: "Configuración de sesión",
    description: "Elige un ajuste rápido o personaliza las reglas.",
    presetsLabel: "Ajustes rápidos",
    mainTimerLabel: "Tiempo de inactividad",
    mainTimerHelp: "Segundos sin pulsaciones de tecla antes de que termine la sesión.",
    globalTimerLabel: "Duración de la sesión",
    globalTimerHelp: "Duración total de la sesión. Desactívalo para una sesión sin límite.",
    globalTimerEnable: "Limitar duración de sesión",
    requiredWordIntervalLabel: "Nueva palabra requerida cada",
    requiredWordIntervalHelp:
      "Tiempo promedio entre nuevas palabras requeridas. Los intervalos reales se distribuyen aleatoriamente alrededor de este valor.",
    requiredWordUseTimerLabel: "Tiempo para usar la palabra requerida",
    requiredWordUseTimerHelp:
      "Si no usas la última palabra requerida a tiempo, la sesión termina.",
    requiredWordUseTimerEnable: "Imponer límite de tiempo para la palabra",
    bellLabel: "Reproducir un campanillazo cuando aparece una nueva palabra",
    secondsSuffix: "s",
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
    yourStory: "Tu historia",
    playAgain: "Volver a jugar",
    copyStory: "Copiar historia",
    copied: "¡Copiado!",
    editHint: "Puedes corregir erratas aquí. El navegador subraya las faltas.",
  },

  units: {
    seconds: "s",
    minutes: "m",
  },
} as const
