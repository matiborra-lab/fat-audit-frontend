// ============================================================
// CONTENIDO DEL CENTRO DE AYUDA Y DEL TUTORIAL GUIADO
// ============================================================
// Todo el texto vive acá adentro (no en CentroAyuda.jsx/Onboarding.jsx) para
// que agregar o corregir un instructivo sea editar solo este archivo. Cada
// artículo/paso describe la cascada real de menú tal como está hoy en
// Layout.jsx (itemsDeNav) - si se mueve una pantalla de lugar, hay que
// actualizar el texto acá.

// Categorías del Centro de ayuda. `roles` filtra la categoría entera;
// además cada artículo puede traer su propio `roles` (subconjunto) cuando
// el paso a paso cambia según quién lo lee - si un artículo no trae
// `roles`, hereda los de la categoría.
export const CATEGORIAS_AYUDA = [
  {
    id: 'calendario',
    titulo: 'Calendario',
    icono: '📅',
    roles: ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'],
    articulos: [
      {
        titulo: 'Cómo leer el calendario',
        pasos: [
          'Menú → Calendario (es la pantalla con la que arranca la app).',
          'Elegí la vista "Semana" o "Mes" arriba a la izquierda.',
          'Tocá cualquier día para ver el detalle abajo: turnos, tareas, auditorías, feriados y cumpleaños de ese día.',
          'Admin y Auditor tienen además un filtro de sucursales (🏢) para ver una, varias o todas a la vez; Gerente y Colaborador ven siempre la suya.',
          'Usá el filtro de tipo (🏷️) para mostrar solo auditorías, tareas, turnos, etc.',
        ],
      },
      {
        titulo: 'Cómo agendar una auditoría, tarea o evento especial',
        roles: ['ADMIN', 'AUDITOR', 'GERENTE'],
        pasos: [
          'Menú → Calendario → botón "+ Agendar" (arriba a la derecha).',
          'Elegí qué querés agendar: Auditoría, Seguimiento, Tarea o Evento especial (Evento especial es solo para Admin).',
          'Completá sucursal, plantilla o tarea del catálogo, responsable y fecha/hora.',
          'Para una Tarea podés dejarla "Sin horario" si aplica a todo el día, y como responsable elegir a una persona puntual o a "Responsables del sector X" para que se resuelva solo, día a día, según quién esté de turno en ese sector.',
          'Si querés que se repita, elegí una recurrencia (diaria, semanal por días puntuales, o mensual) antes de guardar.',
          'Confirmá con el botón de agendar.',
        ],
      },
      {
        titulo: 'Cómo iniciar una auditoría o tarea desde el calendario',
        pasos: [
          'Menú → Calendario → tocá el día en que está agendada.',
          'En el detalle del día, buscá el evento y tocá "Iniciar auditoría" (auditorías/seguimientos) o "Marcar cumplida" (tareas).',
          'El botón se habilita recién cuando llega la fecha/hora programada.',
        ],
      },
    ],
  },
  {
    id: 'tareas',
    titulo: 'Tareas',
    icono: '📝',
    roles: ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'],
    articulos: [
      {
        titulo: 'Cómo ver y completar tus tareas',
        pasos: [
          'Menú → Tareas.',
          'Arriba de todo aparecen las "Demoradas" (si hay alguna), después las "Pendientes de hoy".',
          'Tocá "Pendientes de la semana" o "Historial" para desplegar el resto.',
          'Tocá "Marcar cumplida" al lado de la tarea; si pide foto de evidencia, sacala con la cámara antes de confirmar.',
        ],
      },
      {
        titulo: 'Cómo filtrar el listado de tareas',
        pasos: [
          'Menú → Tareas.',
          'Admin/Auditor: filtro de sucursal y de "asignado a" (por defecto ven todas las sucursales y todos los responsables).',
          'Gerente: filtro de "asignado a" (por defecto "Asignado a mi equipo"; podés elegir a una persona puntual del equipo).',
          'Colaborador no ve el filtro de "asignado a": siempre ve solo lo suyo.',
          'Cualquier rol puede además filtrar por tipo de tarea (Limpieza, Pedidos, etc.).',
        ],
      },
      {
        titulo: 'Cómo editar o eliminar una tarea ya agendada',
        roles: ['ADMIN', 'AUDITOR', 'GERENTE'],
        pasos: [
          'Menú → Tareas, buscá la tarea en cualquiera de los bloques de pendientes.',
          'Tocá "Editar" para cambiar nombre, fecha/hora o responsable, y "Aplicar cambios".',
          'Tocá "Eliminar" para darla de baja.',
          'Gerente: solo puede editar/eliminar las tareas que él mismo agendó (sin importar a quién se las haya asignado). Admin y Auditor pueden con cualquiera.',
        ],
      },
      {
        titulo: 'Catálogo de tareas: qué tareas existen y en qué sucursales',
        roles: ['ADMIN'],
        pasos: [
          'Menú → Configuración → Tareas.',
          'Agrupá tareas dentro de un "tipo" (ej: Limpieza) - el ícono del tipo es el que se ve en el calendario.',
          'Dentro de un tipo, tocá "+ Tarea" para crear una: nombre, si requiere foto de evidencia, y a qué sucursales aplica (o "Todas las sucursales").',
          'Tocá "Editar" sobre una tarea existente para modificarla, o "Desactivar" para que deje de estar disponible al agendar.',
        ],
      },
    ],
  },
  {
    id: 'turnos',
    titulo: 'Turnos',
    icono: '🕒',
    roles: ['ADMIN', 'GERENTE'],
    articulos: [
      {
        titulo: 'Cómo configurar los turnos de una sucursal (horarios y días)',
        pasos: [
          'Menú → Configuración → Sucursales.',
          'Tocá "Horario de turnos" en la sucursal que querés configurar.',
          'Para cada día de la semana, habilitá el turno Diurno y/o Nocturno y definí su horario (desde/hasta).',
          'Un día sin ningún turno habilitado no muestra turno en el calendario ni en Gestionar turnos.',
          'Guardá con "Guardar horario".',
        ],
      },
      {
        titulo: 'Cómo asignar colaboradores a un turno puntual',
        pasos: [
          'Menú → Turnos → Gestionar turnos.',
          'Elegí la semana y la sucursal (Admin) que querés ver.',
          'Tocá el "+" del turno (Diurno o Nocturno) del día que te interesa.',
          'Elegí el puesto y buscá al colaborador por nombre, y confirmá.',
        ],
      },
      {
        titulo: 'Cómo programar asignaciones recurrentes (ej: "todos los lunes")',
        pasos: [
          'Menú → Turnos → Gestionar turnos → sección "Programar asignaciones".',
          'Elegí el colaborador, el puesto, el turno, los días de la semana y el rango de fechas.',
          'Confirmá: se crean automáticamente todas las ocurrencias dentro de ese rango.',
        ],
      },
      {
        titulo: 'Qué tener en cuenta antes de armar los turnos: clima y eventos especiales',
        pasos: [
          'Menú → Calendario o → Turnos → Gestionar turnos: cada día muestra el pronóstico (☀️/🌧️ y temperatura) cuando estás viendo una sola sucursal.',
          'Los "Eventos especiales" (feriados, promociones) que haya cargado Admin aparecen resaltados el mismo día - más movimiento esperado suele pedir más gente en el turno.',
          'Revisá también las Licencias cargadas de ese período antes de asignar a alguien que puede no estar disponible.',
        ],
      },
      {
        titulo: 'Cómo cargar una licencia (vacaciones, salud, etc.)',
        pasos: [
          'Menú → Turnos → Licencias.',
          'Tocá "+ Agregar licencia".',
          'Elegí el colaborador, el motivo, el rango de fechas (desde/hasta) y un detalle opcional.',
          'Guardá: esa persona queda marcada como no disponible en el calendario durante esas fechas.',
        ],
      },
      {
        titulo: 'Cómo resolver una solicitud de "no puedo asistir" a un turno',
        pasos: [
          'Menú → Turnos → Gestionar turnos: si hay una solicitud pendiente aparece avisada arriba de todo.',
          'Buscá el turno con el aviso, abrilo y mirá el motivo.',
          'Reasigná el turno a otra persona (eso resuelve la solicitud automáticamente) o coordinalo por fuera si no hace falta reemplazo.',
        ],
      },
    ],
  },
  {
    id: 'auditorias',
    titulo: 'Auditorías',
    icono: '📋',
    roles: ['ADMIN', 'AUDITOR', 'GERENTE'],
    articulos: [
      {
        titulo: 'Cómo iniciar una auditoría',
        pasos: [
          'Camino rápido: Menú → Auditorías → Nueva auditoría → elegí sucursal y plantilla (Gerente solo puede elegir auditorías internas) → sumá responsables presentes (opcional) → empezá a completar los ítems sector por sector.',
          'Camino agendado: Menú → Calendario → día agendado → "Iniciar auditoría" (se habilita al llegar la fecha/hora).',
        ],
      },
      {
        titulo: 'Cómo crear o editar una plantilla de auditoría',
        roles: ['ADMIN', 'AUDITOR'],
        pasos: [
          'Menú → Auditorías → Plantillas.',
          'Tocá "+ Nueva plantilla" o "✏️ Editar" sobre una existente - una plantilla se puede editar siempre, esté publicada o en borrador (los reportes ya generados no cambian).',
          'Definí si aplica a todas las sucursales, si es interna o de marca, y sus sectores/áreas.',
          'En "Aprobación" definí el % mínimo para que la auditoría quede aprobada (obligatorio), y opcionalmente condiciones extra por sector/área en "Opciones avanzadas".',
          'Agregá o editá los ítems de cada sector, con su área y ponderación.',
          'Guardá con "Aplicar cambios" (o "Crear" si es nueva), y "Publicar" cuando esté lista para usarse.',
        ],
      },
      {
        titulo: 'Cómo ver el historial y eliminar una auditoría abandonada',
        pasos: [
          'Menú → Auditorías → Historial.',
          'Filtrá por sucursal (Admin/Auditor) y por tipo.',
          'Tocá cualquier fila para ver el detalle completo con puntajes.',
          'Solo se puede eliminar una auditoría que quedó "en progreso" y nunca se terminó (nunca una ya completada, para no perder historial real).',
        ],
      },
      {
        titulo: 'Cómo programar el envío automático de un reporte por mail',
        pasos: [
          'Menú → Auditorías → Reportes → "+ Nuevo reporte".',
          'Elegí sucursal (Gerente: siempre la suya), frecuencia (semanal o mensual), día y hora, y los mails destinatarios separados por coma.',
          'Guardá. También podés tocar "Enviar ahora" en cualquier reporte para mandarlo al toque sin esperar la próxima fecha.',
        ],
      },
    ],
  },
  {
    id: 'personal',
    titulo: 'Personal',
    icono: '👥',
    roles: ['ADMIN', 'GERENTE'],
    articulos: [
      {
        titulo: 'Cómo agregar un usuario o colaborador nuevo',
        pasos: [
          'Menú → Configuración → Usuarios (Admin) o Colaboradores (Gerente).',
          'Tocá "+ Invitar usuario" / "+ Invitar colaborador".',
          'Completá email, nombre, rol (Admin) y sucursal/puesto según corresponda; la fecha de nacimiento es opcional.',
          'Al guardar se le manda una invitación por mail para que elija su contraseña.',
        ],
      },
      {
        titulo: 'Cómo agregar o cambiar la fecha de cumpleaños de alguien',
        pasos: [
          'Menú → Configuración → Usuarios/Colaboradores.',
          'Tocá sobre el nombre de la persona para abrir su ficha.',
          'Completá o corregí "Fecha de nacimiento" y guardá.',
          'Ese cumpleaños va a aparecer automáticamente en el calendario de su sucursal cada año.',
        ],
      },
      {
        titulo: 'Cómo deshabilitar o reactivar un usuario',
        pasos: [
          'Menú → Configuración → Usuarios/Colaboradores.',
          'Para dar de baja: tocá "Eliminar" al lado de la persona y confirmá - deja de poder ingresar, pero su nombre se conserva en el historial de tareas y auditorías.',
          'Para reactivar: desplegá "Usuarios deshabilitados" (abajo de la lista) y tocá "Reactivar".',
        ],
      },
      {
        titulo: 'Cómo restablecer la contraseña de alguien',
        pasos: [
          'Menú → Configuración → Usuarios/Colaboradores → tocá sobre la persona.',
          'Tocá "Restablecer contraseña" y confirmá - se le manda un mail con un link para elegir una nueva.',
        ],
      },
      {
        titulo: 'Cómo crear una sucursal nueva',
        roles: ['ADMIN'],
        pasos: [
          'Menú → Configuración → Sucursales → "+ Nueva sucursal".',
          'Completá el nombre y guardá.',
          'Después configurale el horario de turnos (ver el artículo de Turnos) antes de usarla para agendar.',
        ],
      },
    ],
  },
  {
    id: 'notificaciones',
    titulo: 'Notificaciones',
    icono: '🔔',
    roles: ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'],
    articulos: [
      {
        titulo: 'Cómo elegir qué notificaciones recibir',
        pasos: [
          'Menú → Configuración → Notificaciones.',
          'Cada tipo (Tarea, Auditoría, Evento especial, Turno, Cumpleaños, Clima) tiene su propio interruptor.',
          'Los que avisan "antes de" (recordatorios) además dejan elegir con cuánta anticipación.',
          'En "Clima" podés agregar reglas propias (ej: avisarte si va a llover) con "+ Agregar regla".',
        ],
      },
      {
        titulo: 'Cómo activar las notificaciones push en el celular',
        pasos: [
          'Vas a ver un aviso "Activá las notificaciones" arriba de la pantalla, o el ícono de campana (🔔) en el menú.',
          'Tocá "Habilitar notificaciones" y aceptá el permiso que pide el navegador/celular.',
          'Desde ahí vas a recibir avisos aunque no tengas la app abierta.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    icono: '📊',
    roles: ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'],
    articulos: [
      {
        titulo: 'Qué muestra el Dashboard',
        pasos: [
          'Menú → Dashboard.',
          'Puntaje y tendencia de las últimas auditorías, y el promedio por sector y por área.',
          'Admin/Auditor pueden filtrar por sucursal para comparar; Gerente/Colaborador ven siempre la suya.',
        ],
      },
    ],
  },
];

// Filtra las categorías (y dentro de cada una, sus artículos) según el rol
// de quien está mirando - así CentroAyuda.jsx no repite esta lógica.
export function categoriasParaRol(rol) {
  return CATEGORIAS_AYUDA
    .filter((cat) => cat.roles.includes(rol))
    .map((cat) => ({ ...cat, articulos: cat.articulos.filter((a) => !a.roles || a.roles.includes(rol)) }))
    .filter((cat) => cat.articulos.length > 0);
}

// ============================================================
// TUTORIAL GUIADO (bienvenida a usuarios nuevos, ver Onboarding.jsx)
// ============================================================
// Recorrido corto por página, no por artículo - cada paso navega a una
// pantalla real y explica para qué sirve. El Centro de ayuda (arriba) es el
// que entra en el detalle de "cómo hacer" cada cosa.
const PASOS_COMUNES = [
  { path: '/calendario', titulo: 'Calendario', descripcion: 'Acá vas a ver, día por día, los turnos, tareas, auditorías y eventos de tu sucursal. Es la pantalla con la que arranca la app.' },
  { path: '/tareas', titulo: 'Tareas', descripcion: 'Tus tareas pendientes (de hoy y de la semana) y el historial de lo que ya completaste.' },
];
const PASO_DASHBOARD = { path: '/dashboard', titulo: 'Dashboard', descripcion: 'Un resumen de los puntajes y la tendencia de las auditorías.' };
const PASO_NOTIFICACIONES = { path: '/configuracion/notificaciones', titulo: 'Notificaciones', descripcion: 'Elegí qué avisos querés recibir (turnos, tareas, clima, cumpleaños) y con cuánta anticipación.' };
const PASO_AYUDA = { path: '/ayuda', titulo: 'Centro de ayuda', descripcion: 'Si en algún momento te olvidás cómo hacer algo, todos los instructivos paso a paso están acá.' };

export function pasosTour(rol) {
  if (rol === 'COLABORADOR') {
    return [...PASOS_COMUNES, PASO_DASHBOARD, PASO_NOTIFICACIONES, PASO_AYUDA];
  }
  if (rol === 'GERENTE') {
    return [
      ...PASOS_COMUNES,
      { path: '/turnos', titulo: 'Gestionar turnos', descripcion: 'Armá quién trabaja cada día y turno en tu sucursal. Fijate el clima y los eventos especiales antes de organizar.' },
      { path: '/turnos/licencias', titulo: 'Licencias', descripcion: 'Registrá vacaciones, salud u otros motivos por los que alguien no va a poder tomar turnos.' },
      { path: '/ejecutar', titulo: 'Nueva auditoría', descripcion: 'Iniciá una auditoría interna o un seguimiento cuando quieras, sin esperar a que esté agendada.' },
      { path: '/historial', titulo: 'Historial', descripcion: 'Los resultados de auditorías anteriores de tu sucursal.' },
      { path: '/reportes-programados', titulo: 'Reportes', descripcion: 'Programá el envío automático por mail de los resultados de auditoría.' },
      PASO_DASHBOARD,
      { path: '/configuracion/usuarios', titulo: 'Colaboradores', descripcion: 'Invitá gente nueva a tu equipo, cargá su cumpleaños y date de baja a quien ya no trabaje más.' },
      PASO_NOTIFICACIONES,
      PASO_AYUDA,
    ];
  }
  if (rol === 'AUDITOR') {
    return [
      ...PASOS_COMUNES,
      { path: '/ejecutar', titulo: 'Nueva auditoría', descripcion: 'Iniciá una auditoría o seguimiento en la sucursal que elijas.' },
      { path: '/auditorias', titulo: 'Plantillas', descripcion: 'Creá y editá las plantillas de auditoría (sectores, áreas, ítems y aprobación).' },
      { path: '/historial', titulo: 'Historial', descripcion: 'Los resultados de todas las auditorías ya hechas.' },
      { path: '/reportes-programados', titulo: 'Reportes', descripcion: 'Programá el envío automático por mail de los resultados de auditoría.' },
      PASO_DASHBOARD,
      PASO_NOTIFICACIONES,
      PASO_AYUDA,
    ];
  }
  // ADMIN
  return [
    ...PASOS_COMUNES,
    { path: '/turnos', titulo: 'Gestionar turnos', descripcion: 'Armá quién trabaja cada día y turno en cada sucursal.' },
    { path: '/turnos/licencias', titulo: 'Licencias', descripcion: 'Vacaciones, salud u otros motivos por los que alguien no puede tomar turnos.' },
    { path: '/ejecutar', titulo: 'Nueva auditoría', descripcion: 'Iniciá una auditoría o seguimiento en la sucursal que elijas.' },
    { path: '/auditorias', titulo: 'Plantillas', descripcion: 'Creá y editá las auditorías que se le hacen a cada sucursal - siempre se pueden modificar, aunque ya estén publicadas.' },
    { path: '/historial', titulo: 'Historial', descripcion: 'Los resultados de todas las auditorías ya hechas, en todas las sucursales.' },
    { path: '/reportes-programados', titulo: 'Reportes', descripcion: 'Programá el envío automático por mail de los resultados de auditoría.' },
    PASO_DASHBOARD,
    { path: '/configuracion/sucursales', titulo: 'Sucursales', descripcion: 'Creá sucursales nuevas y configurá el horario de sus turnos.' },
    { path: '/configuracion/usuarios', titulo: 'Usuarios', descripcion: 'Invitá gente nueva, asigná roles y sucursales, y dá de baja a quien corresponda.' },
    { path: '/configuracion/tareas', titulo: 'Catálogo de tareas', descripcion: 'Definí qué tareas rutinarias existen (limpieza, pedidos, etc.) y en qué sucursales aplican.' },
    PASO_NOTIFICACIONES,
    PASO_AYUDA,
  ];
}
