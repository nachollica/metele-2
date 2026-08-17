// Spanish translations for Flowfic.
//
// `satisfies Translations` (bottom of the file) makes drift a compile error in
// BOTH directions: a key missing here or an extra key not present in en.ts
// fails `tsc`, instead of silently shipping a stale dictionary.

import type { Translations } from "./en"

export const es = {
  app: {
    title: "Flowfic",
    loading: "Cargando FLOWFIC…",
    // Lo primero que recibe el foco: salta los controles de la barra superior,
    // que si no se interponen entre el teclado y la pantalla.
    skipToContent: "Saltar al contenido",
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
        title: "Bienvenido a Flowfic",
        body: "Un juego de escritura donde tus manos no paran. Reglas rápidas antes de empezar.",
      },
      prepare: {
        title: "Prepara tu sesión",
        body: "Configura tu juego y elige tu velocidad. También puedes buscar algo de inspiración antes de empezar.",
      },
      createStory: {
        title: "Escribe sin parar",
        body: "Sigue escribiendo en el editor. Si te quedas inactivo demasiado, la sesión termina. Después puedes editar tu historia.",
      },
      requiredWords: {
        title: "Palabras requeridas",
        body: "Aparecen palabras mientras escribes. Úsalas antes de que desaparezcan. En algunos modos, una palabra sin usar termina la sesión.",
      },
      levelUp: {
        title: "Sube de nivel escribiendo",
        body: "Cada sesión terminada suma XP, alimenta tu racha diaria y avanza tus logros y desafíos diarios. Con una cuenta puedes seguir tu progreso.",
      },
    },
  },

  settings: {
    title: "Ajustes avanzados",
    description: "Afina los temporizadores y las palabras requeridas.",
    presetsLabel: "Modos de juego",
    moreOptions: "Más opciones",
    sessionLengthLabel: "Duración de la sesión",
    // Encabezado visible sobre el dial de la sesión (el control del dial
    // conserva `sessionLengthLabel` como nombre accesible).
    selectDuration: "Elige una duración",
    mainTimerLabel: "Tiempo de inactividad",
    mainTimerHelp: "Segundos inactivo antes de terminar.",
    idleTimerEnable: "Activar el tiempo de inactividad",
    requiredWordIntervalEnable: "Activar palabras requeridas",
    requiredWordIntervalLabel: "Nueva palabra requerida cada",
    requiredWordIntervalHelp: "Intervalo promedio entre palabras; aleatorio.",
    requiredWordUseTimerLabel: "Tiempo para usar la palabra requerida",
    requiredWordUseTimerHelp:
      "Activado: las palabras no usadas terminan la sesión. Desactivado: desaparecen tras unos segundos.",
    requiredWordUseTimerEnable: "Imponer límite de tiempo para la palabra",
    requiredWordsLabel: "Palabras requeridas",
    requiredWordsHelp:
      "Aparecen palabras mientras escribes. Escríbelas antes de que desaparezcan.",
    wordSourceLabel: "Origen de las palabras",
    wordSourceFree: "Palabras libres",
    wordSourceUniverse: "Universo narrativo",
    wordSourceSeedsLabel: "Palabras semilla",
    wordSourceSeedsPlaceholder: "cocina, comida, restaurantes",
    wordSourceUniversePlaceholder: "p. ej. Franz Kafka",
    soundLabel: "Sonido al aparecer una palabra",
    soundHelp: "Reproduce un sonido cada vez que aparece una palabra requerida.",
    soundEnable: "Activar sonido de palabra",
    soundModeLabel: "Tipo de sonido",
    soundBell: "Campana",
    soundSpeak: "Decir la palabra",
    loadingWords: "Cargando palabras…",
    start: "Empezar a escribir",
    customModesLabel: "Modos personalizados",
    backToPresetsLabel: "Modos predeterminados",
    createPresetLabel: "Guardar configuración actual",
    createPresetTooltip: "Guarda los ajustes de arriba como un modo personalizado.",
    customNamePlaceholder: "Nombre del modo",
    customNameSave: "Guardar",
    customNameCancel: "Cancelar",
    customLimitReached: "Puedes tener como máximo {max} modos personalizados.",
    customSaveFailed: "No se pudo guardar el modo personalizado.",
    signInForCustomModes: "Inicia sesión para guardar modos personalizados.",
  },

  presets: {
    classic: {
      name: "Clásico",
      description: "Ajustes equilibrados. Un buen punto de partida.",
    },
    speed: {
      name: "Rápido",
      description: "Poco tiempo inactivo, sin palabras requeridas. No pares.",
    },
    creative: {
      name: "Súper creativo",
      description: "Las palabras requeridas llegan sin parar. Mantente ágil.",
    },
  },

  game: {
    requiredWordHeader: "Palabra requerida",
    useWordIn: "Úsala en",
    idleEndsIn: "Inactividad en",
    sessionEndsIn: "Sesión termina en",
    characters: "caracteres",
    placeholder: "Empieza tu historia. No dejes de escribir…",
    pause: "Pausar",
    // Los controles de sesión son cuadros con solo icono, así que esto son
    // nombres accesibles y no etiquetas visibles: caben completos.
    resume: "Continuar",
    // Se anuncia al congelar o reanudar la sesión. Se puede pausar sin que el
    // botón llegue a tener el foco (el diálogo de salir también pausa), así que
    // el estado hay que decirlo, no dejarlo en el nombre del botón.
    pausedStatus: "Sesión en pausa. Los temporizadores están congelados.",
    resumedStatus: "Sesión reanudada.",
    quit: "Salir de sesión",
    quitConfirmTitle: "¿Salir de esta sesión?",
    quitConfirmDescription:
      "Tu sesión termina aquí y verás tus estadísticas. La historia seguirá siendo editable después.",
    quitConfirm: "Salir",
    quitCancel: "Seguir escribiendo",
    // Cierre final de una sesión terminada: guarda la historia y vuelve al inicio.
    finish: "Guardar historia",
    titleLabel: "Título de la historia",
    inspirationShow: "Mostrar inspiración",
    inspirationHide: "Ocultar inspiración",
    // El h1 de la sesión. Nunca se ve: el centro de la barra está vacío
    // durante la sesión a propósito, así que esto existe para que la pantalla
    // no se quede sin encabezado.
    sprintHeading: "Sesión de escritura",
    viewingStory: "Viendo una historia anterior (solo lectura).",
    // Nombra el visor de solo lectura. Sin esto el campo hereda el
    // `placeholder` del editor, así que una historia guardada se anuncia como
    // una invitación a empezar a escribirla.
    storyTextLabel: "Texto de la historia",
    saveFailed: "No se pudo guardar tu última historia.",
    saveRetry: "Reintentar",
    saveRetrying: "Reintentando…",
    saveDismiss: "Descartar",
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
    empty: "Aún no hay historias — termina una sesión para verla aquí.",
    signUpPrompt: "Inicia sesión para ver tus historias guardadas aquí.",
    error: "No se pudieron cargar las historias.",
    rowMenuLabel: "Opciones de la historia",
    deleteStory: "Eliminar",
    deleteStoryConfirmTitle: "¿Eliminar esta historia?",
    deleteStoryConfirmDescription:
      "Esto elimina la historia permanentemente. Esta acción no se puede deshacer.",
    deleteStoryConfirm: "Eliminar",
    deleteStoryCancel: "Cancelar",
    deleteStoryFailed: "No se pudo eliminar la historia.",
    // Encabeza la lista de Mis historias. El tamaño de la biblioteca vive aquí,
    // junto a las historias, y ya no en la pantalla de perfil.
    storyCount: "{count} historias",
    resultCount: "{count} coincidencias",
    loadMore: "Cargar más",
    loadingMore: "Cargando…",
    renameStory: "Renombrar",
    renameStoryLabel: "Título de la historia",
    renameSave: "Guardar título",
    renameCancel: "Cancelar",
    searchPlaceholder: "Busca en tus historias…",
    filterByDate: "Cualquier fecha",
    filterClear: "Limpiar",
    sortLabel: "Orden",
    sortNewest: "Recientes",
    sortOldest: "Antiguas",
    noResults: "Ninguna historia coincide con tu búsqueda.",
  },

  prefs: {
    // El botón de la cabecera es solo icono, así que su nombre accesible debe
    // decir qué hace el clic en vez de nombrar el control.
    modeSwitchToDark: "Cambiar al modo oscuro",
    modeSwitchToLight: "Cambiar al modo claro",
    languageLabel: "Idioma",
  },

  auth: {
    logIn: "Iniciar sesión",
    logOut: "Cerrar sesión",
    title: "Inicia sesión en Flowfic",
    description:
      "Puedes jugar sin cuenta. Inicia sesión para guardar tus historias y seguir tu progreso.",
    continueWith: "Continuar con {provider}",
    google: "Google",
    finishingSignIn: "Terminando el inicio de sesión…",
    signInFailed: "Falló el inicio de sesión.",
    backToGame: "Volver al juego",
    accountMenuLabel: "Menú de cuenta",
    devUserLogin: "Inicio de sesión dev",
    devUsernameLabel: "Usuario de desarrollo",
    devUsernamePlaceholder: "usuario",
    devLoginSubmit: "Entrar como usuario dev",
    devUserNotFound: "No existe un usuario dev con ese nombre. Créalo primero.",
    devLoginFailed: "Falló el login de desarrollo. Asegúrate de que el backend esté corriendo.",
    providersDivider: "con un proveedor",
    emailInvalid: "Ingresa un correo válido.",
  },

  nav: {
    label: "Navegación principal",
    home: "Inicio",
    stories: "Mis historias",
    progress: "Mi progreso",
    challenges: "Desafíos",
    stats: "Estadísticas",
    achievements: "Logros",
    showAll: "Ver todo",
    // Nombre accesible de la X en la esquina de un diálogo, común a todos.
    closeDialog: "Cerrar",
    // Título en la cabecera de la pantalla de inicio: la única pantalla sin
    // título propio, nombrada por aquello para lo que sirve.
    createStory: "Crea una historia",
    backToHome: "Volver al inicio",
    // Etiqueta de la flecha atrás en una historia / un "no encontrado" que se
    // alcanzó desde ella: vuelve a la lista de historias, no al inicio.
    backToStories: "Volver a mis historias",
  },

  // Pantalla de "no encontrado" renderizada en cliente: para una ruta
  // desconocida o una historia cuyo id no resuelve. No hay 404 de servidor: el
  // shell de la SPA se sirve para toda ruta (ver prod/conf/Caddyfile).
  notFound: {
    title: "Página no encontrada",
    body: "No pudimos encontrar lo que buscabas.",
    backHome: "Volver al inicio",
  },

  dashboard: {
    back: "Volver",
    level: "Nivel",
    signInHint: "Inicia sesión para guardar historias y seguir tu progreso.",
    daysInARow: "días seguidos",
    weeklySummary: "Resumen semanal",
    sessions: "sesiones",
    words: "palabras",
    totalTime: "tiempo total",
    untitledStory: "Historia sin título",
    today: "Hoy",
    emptyStories: "Aún no hay historias — terminá una sesión para verla aquí.",
    // Título del gráfico de palabras por día. Nombrado por lo que será: los
    // botones de semana/mes lo cambiarán junto al resumen que tiene al lado.
    timeline: "Cronología",
    chartCaption: "Palabras escritas por día en los últimos 7 días.",
    minutes: "minutos",
    challengeOfDay: "Desafío del día",
    challengeOfDayHint: "Entra directo",
    recentStories: "Historias recientes",
    inspirationAlt: "Imagen de inspiración",
    inspirationPrompt: "Haz clic aquí para inspirarte",
    inspirationAnother: "Muéstrame otra inspiración",
    inspirationUnavailable: "No hay inspiración disponible ahora mismo.",
    // Los tres selectores circulares del inicio y el panel que rellenan. Van
    // DENTRO de los círculos, así que tienen que ser cortas en ambos idiomas.
    // El de inspiración es el único que además es una acción: una vez elegido,
    // vuelve a tirar, y así lo dice.
    showcaseLabel: "Elige qué mostrar",
    showcasePaneLabel: "Mostrando: {name}",
    inspirationTabCurrent: "Inspiración",
    inspirationTabAnother: "Haz clic para otra",
  },

  achievements: {
    unlockedSummary: "{count} de {total} desbloqueados",
    items: {
      first_session: { name: "Primer paso", description: "Completá tu primera sesión" },
      streak_7: { name: "Escritor constante", description: "Escribí 7 días seguidos" },
      streak_30: { name: "Imparable", description: "Escribí 30 días seguidos" },
      wordsmith: { name: "Artesano de palabras", description: "Escribí 10.000 palabras en total" },
      marathon: { name: "Maratonista", description: "Escribí por 5 horas en total" },
      big_session: { name: "En la zona", description: "Escribí 750 palabras en una sesión" },
      night_owl: { name: "Búho nocturno", description: "Escribí una sesión pasada la medianoche" },
      early_bird: { name: "Madrugador", description: "Escribí una sesión al amanecer" },
    },
  },

  challenges: {
    completed: "Completado",
    dailyGroup: "Desafíos diarios",
    items: {
      daily_600: { name: "Sesión diaria", description: "Escribí 600 palabras hoy" },
      weekly_5_sessions: { name: "Cinco por semana", description: "Completá 5 sesiones esta semana" },
      keep_streak: { name: "Mantené la llama", description: "Escribí hoy para no perder tu racha" },
    },
  },
} as const satisfies Translations
