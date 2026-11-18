/**
 * ConfigPersonalView.js
 * Vista POO para Configuración de Agenda (intervalo, plantilla semanal, catálogo de servicios,
 * excepciones/bloqueos), Matriz de Perfiles y Permisos por Módulo (tabla donde los encabezados son
 * las actividades específicas del módulo seleccionado y los renglones son los perfiles con niveles
 * de acceso y casillas de selección), gestión de Personal y Bitácora de Auditoría.
 */
export class ConfigPersonalView {
  static DEFAULT_MODULOS_MATRIZ = [
    {
      id: 'agenda',
      nombre: 'Agenda, Turnos y Citas',
      icono: 'fa-calendar-days',
      descripcion: 'Calendario diario y semanal, bloques de horario, asistencia de mascotas y cobro de citas.',
      actividades: [
        {
          key: 'agenda_acceso_modulo',
          titulo: 'Acceso al Calendario de Agenda',
          subtitulo: 'Ver pestaña Agenda (Día / Semana) y citas programadas',
          es_acceso_modulo: true,
        },
        {
          key: 'agenda_kpis_cobro_dia',
          titulo: 'KPIs Financieros del Día',
          subtitulo: 'Ver cuánto se va a cobrar, cobrado real, efectivo y tarjeta',
        },
        {
          key: 'agenda_crear_citas',
          titulo: 'Agendar Nuevas Citas',
          subtitulo: 'Seleccionar bloques disponibles y registrar turnos futuros',
        },
        {
          key: 'agenda_asistencia_cobro',
          titulo: 'Marcar Asistió / No Asistió y Cobrar',
          subtitulo: 'Confirmar asistencia en tarjeta de mascota y registrar pago',
        },
        {
          key: 'agenda_cancelar_editar',
          titulo: 'Editar Citas, Precios y Notas',
          subtitulo: 'Modificar precio pactado, estilista asignado o cancelar cita',
        },
      ],
    },
    {
      id: 'clientes',
      nombre: 'Clientes, Mascotas y Expedientes',
      icono: 'fa-dog',
      descripcion: 'Buscador lateral privado, expediente clínico de mascotas y base de datos completa.',
      actividades: [
        {
          key: 'cli_acceso_padron_completo',
          titulo: 'Módulo Base de Datos Completa',
          subtitulo: 'Ver tabla general de Clientes y Mascotas con filtros por columna',
          es_acceso_modulo: true,
        },
        {
          key: 'cli_buscador_lateral',
          titulo: 'Buscador Lateral de Cuentas',
          subtitulo: 'Buscar clientes por nombre, código PET- o últimos 4 dígitos',
        },
        {
          key: 'cli_expediente_perfil',
          titulo: 'Expediente y Perfil de Cliente',
          subtitulo: 'Abrir pop-up de perfil, historial de servicios y ficha técnica',
        },
        {
          key: 'cli_alta_edicion_clientes',
          titulo: 'Alta y Edición de Clientes (Dueños)',
          subtitulo: 'Botón Registrar Nuevo Cliente y edición de datos del dueño',
        },
        {
          key: 'cli_alta_edicion_mascotas',
          titulo: 'Alta y Ficha Clínica de Mascotas',
          subtitulo: 'Agregar mascotas al dueño, raza, alergias, navaja y shampoo',
        },
      ],
    },
    {
      id: 'dashboard',
      nombre: 'Dashboard e Indicadores',
      icono: 'fa-chart-pie',
      descripcion: 'Métricas ejecutivas, ingresos acumulados, gráficas de desempeño y alertas.',
      actividades: [
        {
          key: 'dash_acceso_modulo',
          titulo: 'Acceso al Módulo Dashboard',
          subtitulo: 'Ver pestaña Dashboard en el menú principal',
          es_acceso_modulo: true,
        },
        {
          key: 'dash_kpis_financieros',
          titulo: 'KPIs de Ingresos y Ticket Promedio',
          subtitulo: 'Consultar ingresos históricos, ingresos de hoy y métricas de caja',
        },
        {
          key: 'dash_graficas_operativas',
          titulo: 'Gráficas por Servicio y Estilista',
          subtitulo: 'Visualizar distribución de citas, métodos de pago y productividad',
        },
        {
          key: 'dash_alertas_stock',
          titulo: 'Alertas de Inventario y Turnos',
          subtitulo: 'Monitorear productos en stock crítico y próximas citas',
        },
      ],
    },
    {
      id: 'inventario',
      nombre: 'Inventario y Terminal Escáner',
      icono: 'fa-boxes-stacked',
      descripcion: 'Catálogo de insumos y productos comerciales, control de existencias y lector de barras.',
      actividades: [
        {
          key: 'inv_acceso_modulo',
          titulo: 'Acceso al Módulo Inventario',
          subtitulo: 'Ver pestaña Inventario y tabla de existencias',
          es_acceso_modulo: true,
        },
        {
          key: 'inv_catalogo_productos',
          titulo: 'Alta y Edición de Productos',
          subtitulo: 'Registrar nuevos productos, categorías, stock mínimo y precios',
        },
        {
          key: 'inv_escaner_descuento',
          titulo: 'Escáner: Consumo de Insumos',
          subtitulo: 'Descontar shampoo o material interno mediante código de barras',
        },
        {
          key: 'inv_escaner_venta',
          titulo: 'Escáner: Venta de Productos',
          subtitulo: 'Vender accesorios/alimento con código y registrar cobro automático',
        },
      ],
    },
    {
      id: 'caja',
      nombre: 'Caja, Cobros y Cortes',
      icono: 'fa-cash-register',
      descripcion: 'Flujo de efectivo, pagos con tarjeta/transferencia, ingresos manuales y cierre de turno.',
      actividades: [
        {
          key: 'caja_acceso_modulo',
          titulo: 'Acceso al Módulo Caja y Cobros',
          subtitulo: 'Ver pestaña Caja y bitácora de transacciones financieras',
          es_acceso_modulo: true,
        },
        {
          key: 'caja_movimientos_manuales',
          titulo: 'Registrar Ingresos Manuales',
          subtitulo: 'Capturar cobros directos, propinas o conceptos adicionales',
        },
        {
          key: 'caja_corte_turno',
          titulo: 'Corte de Caja y Arqueo',
          subtitulo: 'Declarar efectivo al cerrar turno y auditar totales por método',
        },
      ],
    },
    {
      id: 'config',
      nombre: 'Configuración, Personal y Perfiles',
      icono: 'fa-sliders',
      descripcion: 'Reglas de agenda, horarios semanales, catálogo de servicios, plantilla y matriz de permisos.',
      actividades: [
        {
          key: 'cfg_acceso_modulo',
          titulo: 'Acceso a Configuración y Personal',
          subtitulo: 'Ver pestaña Configuración y Personal en el menú',
          es_acceso_modulo: true,
        },
        {
          key: 'cfg_horarios_plantilla',
          titulo: 'Horarios, Capacidad y Excepciones',
          subtitulo: 'Editar apertura/cierre, estilistas activos y bloqueos de calendario',
        },
        {
          key: 'cfg_catalogo_servicios',
          titulo: 'Catálogo de Servicios y Precios',
          subtitulo: 'Crear y actualizar servicios de estética, tiempos y tarifas base',
        },
        {
          key: 'cfg_gestion_personal',
          titulo: 'Administración de Colaboradores',
          subtitulo: 'Dar de alta usuarios, asignar perfil, cambiar contraseña o eliminar',
        },
        {
          key: 'cfg_perfiles_permisos',
          titulo: 'Matriz de Perfiles e Impersonate',
          subtitulo: 'Crear/editar perfiles, configurar esta tabla y simular vistas (Impersonate)',
        },
      ],
    },
  ];

  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.plantillaActual = [];
    this.personalActual = [];
    this.sucursalesOrg = [];
    this.perfiles = [];
    this.modulosMatriz = ConfigPersonalView.DEFAULT_MODULOS_MATRIZ;
    this.moduloActivoId = 'agenda';
  }

  init() {
    const formConfig = document.getElementById('form-agenda-config');
    if (formConfig) {
      formConfig.addEventListener('submit', (e) => {
        e.preventDefault();
        this.guardarConfigAgenda();
      });
    }

    const btnGuardarPlantilla = document.getElementById('btn-guardar-plantilla-semanal');
    if (btnGuardarPlantilla) {
      btnGuardarPlantilla.addEventListener('click', () => this.guardarPlantillaSemanal());
    }

    const formServicio = document.getElementById('form-crear-servicio');
    if (formServicio) {
      formServicio.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearServicioCatalogo();
      });
    }

    const formExcepcion = document.getElementById('form-crear-excepcion');
    if (formExcepcion) {
      formExcepcion.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearExcepcionAgenda();
      });
    }

    const formPersonal = document.getElementById('form-crear-personal');
    if (formPersonal) {
      formPersonal.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearPersonal();
      });
    }

    const formEditPersonal = document.getElementById('form-editar-personal');
    if (formEditPersonal) {
      formEditPersonal.addEventListener('submit', (e) => {
        e.preventDefault();
        this.guardarEdicionPersonal();
      });
    }

    const cerrarModalBtns = [
      document.getElementById('btn-cerrar-modal-personal'),
      document.getElementById('btn-cancelar-modal-personal'),
    ];
    cerrarModalBtns.forEach((btn) => {
      if (btn) {
        btn.addEventListener('click', () => this.cerrarModalEditarPersonal());
      }
    });

    this.initEventosMatrizPerfiles();
  }

  initEventosMatrizPerfiles() {
    const selectModulo = document.getElementById('perfiles-modulo-select');
    if (selectModulo) {
      selectModulo.addEventListener('change', () => {
        this.moduloActivoId = selectModulo.value || 'agenda';
        this.renderMatrizPerfilesPorModulo();
      });
    }

    const btnMostrarCrear = document.getElementById('btn-mostrar-crear-perfil');
    const btnCancelarCrear = document.getElementById('btn-cancelar-crear-perfil');
    const formCrearPerfil = document.getElementById('form-crear-nuevo-perfil');

    if (btnMostrarCrear && formCrearPerfil) {
      btnMostrarCrear.addEventListener('click', () => {
        formCrearPerfil.classList.toggle('hidden');
        if (!formCrearPerfil.classList.contains('hidden')) {
          document.getElementById('nuevo-perfil-nombre')?.focus();
        }
      });
    }

    if (btnCancelarCrear && formCrearPerfil) {
      btnCancelarCrear.addEventListener('click', () => {
        formCrearPerfil.classList.add('hidden');
        formCrearPerfil.reset();
      });
    }

    if (formCrearPerfil) {
      formCrearPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.crearNuevoPerfilEnMatriz();
      });
    }

    const btnGuardarMatriz = document.getElementById('btn-guardar-permisos-perfil');
    if (btnGuardarMatriz) {
      btnGuardarMatriz.addEventListener('click', async () => {
        await this.guardarMatrizCompleta();
      });
    }
  }

  async load() {
    await Promise.all([
      this.cargarAgendaConfig(),
      this.cargarPersonalYBitacora(),
    ]);
  }

  async cargarAgendaConfig() {
    try {
      const data = await this.api.get('/agenda-config');
      const cfg = data.config || {};

      const modoEl = document.getElementById('cfg-modo-asignacion');
      const intEl = document.getElementById('cfg-intervalo-minutos');
      if (modoEl) modoEl.value = cfg.modo_asignacion || 'global';
      if (intEl) intEl.value = cfg.intervalo_minutos || 60;

      this.plantillaActual = data.plantilla_semanal || [];
      this.renderPlantillaSemanal(this.plantillaActual);
      this.renderServiciosCatalogo(data.servicios_catalogo || []);
      this.renderExcepciones(data.excepciones || []);
    } catch (err) {
      this.notify(`Error al cargar configuración de agenda: ${err.message}`, 'error');
    }
  }

  renderPlantillaSemanal(dias) {
    const tbody = document.getElementById('cfg-plantilla-tbody');
    if (!tbody) return;

    const diasBase = [
      { dia_semana: 0, nombre_dia: 'Lunes' },
      { dia_semana: 1, nombre_dia: 'Martes' },
      { dia_semana: 2, nombre_dia: 'Miércoles' },
      { dia_semana: 3, nombre_dia: 'Jueves' },
      { dia_semana: 4, nombre_dia: 'Viernes' },
      { dia_semana: 5, nombre_dia: 'Sábado' },
      { dia_semana: 6, nombre_dia: 'Domingo' },
    ];

    const filas = diasBase.map((base) => {
      const existente = dias.find((d) => Number(d.dia_semana) === base.dia_semana) || {};
      return {
        id: existente.id || '',
        dia_semana: base.dia_semana,
        nombre_dia: existente.nombre_dia || base.nombre_dia,
        activo: existente.activo !== undefined ? existente.activo : base.dia_semana < 6,
        hora_apertura: (existente.hora_apertura || '09:00:00').slice(0, 5),
        hora_cierre: (existente.hora_cierre || '18:00:00').slice(0, 5),
        estilistas_activos: existente.estilistas_activos ?? 2,
        comida_inicio: (existente.comida_inicio || '14:00:00').slice(0, 5),
        comida_fin: (existente.comida_fin || '15:00:00').slice(0, 5),
        estilistas_en_comida: existente.estilistas_en_comida ?? 1,
      };
    });

    tbody.innerHTML = filas
      .map(
        (d) => `
        <tr class="border-b border-slate-100 text-xs" data-dia-row="${d.dia_semana}" data-row-id="${d.id}">
          <td class="py-2 px-2 font-semibold text-slate-800">${d.nombre_dia}</td>
          <td class="py-2 px-2 text-center">
            <input type="checkbox" class="row-activo rounded text-blue-600" ${
              d.activo ? 'checked' : ''
            } />
          </td>
          <td class="py-2 px-2">
            <input type="time" class="row-apertura border border-slate-200 rounded px-1.5 py-1" value="${
              d.hora_apertura
            }" />
          </td>
          <td class="py-2 px-2">
            <input type="time" class="row-cierre border border-slate-200 rounded px-1.5 py-1" value="${
              d.hora_cierre
            }" />
          </td>
          <td class="py-2 px-2">
            <input type="number" min="1" max="20" class="row-estilistas w-14 border border-slate-200 rounded px-1.5 py-1 text-center" value="${
              d.estilistas_activos
            }" />
          </td>
          <td class="py-2 px-2">
            <input type="time" class="row-comida-ini border border-slate-200 rounded px-1.5 py-1" value="${
              d.comida_inicio
            }" />
          </td>
          <td class="py-2 px-2">
            <input type="time" class="row-comida-fin border border-slate-200 rounded px-1.5 py-1" value="${
              d.comida_fin
            }" />
          </td>
          <td class="py-2 px-2">
            <input type="number" min="0" max="20" class="row-estilistas-comida w-14 border border-slate-200 rounded px-1.5 py-1 text-center" value="${
              d.estilistas_en_comida
            }" />
          </td>
        </tr>`
      )
      .join('');
  }

  async guardarConfigAgenda() {
    const modo_asignacion =
      document.getElementById('cfg-modo-asignacion')?.value || 'global';
    const intervalo_minutos = Number(
      document.getElementById('cfg-intervalo-minutos')?.value || 60
    );

    try {
      await this.api.put('/agenda-config', {
        modo_asignacion,
        intervalo_minutos,
      });
      this.notify('Configuración general de agenda actualizada.', 'success');
    } catch (err) {
      this.notify(`Error al guardar configuración: ${err.message}`, 'error');
    }
  }

  async guardarPlantillaSemanal() {
    const rows = document.querySelectorAll('#cfg-plantilla-tbody tr[data-dia-row]');
    const dias = [];

    rows.forEach((tr) => {
      const dia_semana = Number(tr.getAttribute('data-dia-row'));
      const id = tr.getAttribute('data-row-id') || undefined;
      const activo = tr.querySelector('.row-activo')?.checked ?? true;
      const hora_apertura = `${tr.querySelector('.row-apertura')?.value || '09:00'}:00`;
      const hora_cierre = `${tr.querySelector('.row-cierre')?.value || '18:00'}:00`;
      const estilistas_activos = Number(
        tr.querySelector('.row-estilistas')?.value || 2
      );
      const comida_inicio = `${tr.querySelector('.row-comida-ini')?.value || '14:00'}:00`;
      const comida_fin = `${tr.querySelector('.row-comida-fin')?.value || '15:00'}:00`;
      const estilistas_en_comida = Number(
        tr.querySelector('.row-estilistas-comida')?.value || 1
      );

      dias.push({
        id,
        dia_semana,
        activo,
        hora_apertura,
        hora_cierre,
        estilistas_activos,
        comida_inicio,
        comida_fin,
        estilistas_en_comida,
      });
    });

    try {
      await this.api.put('/agenda-config/plantilla', { dias });
      this.notify('Plantilla semanal guardada correctamente.', 'success');
      await this.cargarAgendaConfig();
    } catch (err) {
      this.notify(`Error al guardar plantilla semanal: ${err.message}`, 'error');
    }
  }

  renderServiciosCatalogo(servicios) {
    const container = document.getElementById('cfg-servicios-lista');
    if (!container) return;

    if (!servicios.length) {
      container.innerHTML = `<p class="text-xs text-slate-400">No hay servicios en el catálogo.</p>`;
      return;
    }

    container.innerHTML = servicios
      .map(
        (s) => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span class="font-bold text-slate-800">${s.nombre}</span>
            <span class="text-slate-500 ml-1">(${s.duracion_minutos} min)</span>
          </div>
          <span class="font-bold text-blue-700">$${Number(s.precio_base || 0).toFixed(2)}</span>
        </div>`
      )
      .join('');
  }

  async crearServicioCatalogo() {
    const nombre = document.getElementById('srv-nombre')?.value.trim();
    const duracion_minutos = Number(document.getElementById('srv-duracion')?.value || 60);
    const precio_base = Number(document.getElementById('srv-precio')?.value || 0);

    if (!nombre) {
      this.notify('Ingresa el nombre del servicio.', 'warning');
      return;
    }

    try {
      await this.api.post('/agenda-config/servicios', {
        nombre,
        duracion_minutos,
        precio_base,
        activo: true,
      });
      this.notify('Servicio agregado al catálogo.', 'success');
      document.getElementById('form-crear-servicio')?.reset();
      await this.cargarAgendaConfig();
    } catch (err) {
      this.notify(`Error al agregar servicio: ${err.message}`, 'error');
    }
  }

  renderExcepciones(excepciones) {
    const container = document.getElementById('cfg-excepciones-lista');
    if (!container) return;

    if (!excepciones.length) {
      container.innerHTML = `<p class="text-xs text-slate-400">Sin excepciones o bloqueos programados.</p>`;
      return;
    }

    container.innerHTML = excepciones
      .map(
        (ex) => `
        <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
          <div>
            <span class="font-bold text-amber-900">${ex.fecha}</span>
            <span class="text-amber-700 ml-1">${ex.motivo || 'Ajuste de agenda'}</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
            ${ex.cerrado_todo_el_dia ? 'Cerrado total' : `${ex.estilistas_disponibles} estilista(s)`}
          </span>
        </div>`
      )
      .join('');
  }

  async crearExcepcionAgenda() {
    const fecha = document.getElementById('exc-fecha')?.value;
    const cerrado_todo_el_dia =
      document.getElementById('exc-cerrado')?.checked || false;
    const estilistas_disponibles = Number(
      document.getElementById('exc-estilistas')?.value || 0
    );
    const motivo = document.getElementById('exc-motivo')?.value.trim() || '';

    if (!fecha) {
      this.notify('Selecciona la fecha de la excepción.', 'warning');
      return;
    }

    try {
      await this.api.post('/agenda-config/excepciones', {
        fecha,
        cerrado_todo_el_dia,
        estilistas_disponibles,
        motivo,
      });
      this.notify('Excepción de agenda registrada.', 'success');
      document.getElementById('form-crear-excepcion')?.reset();
      await this.cargarAgendaConfig();
    } catch (err) {
      this.notify(`Error al guardar excepción: ${err.message}`, 'error');
    }
  }

  async cargarPersonalYBitacora() {
    try {
      const data = await this.api.get('/personal');
      this.personalActual = data.personal || [];
      this.sucursalesOrg = data.sucursales || [];

      if (Array.isArray(data.modulos_matriz) && data.modulos_matriz.length) {
        this.modulosMatriz = data.modulos_matriz;
      }

      if (Array.isArray(data.perfiles) && data.perfiles.length) {
        this.perfiles = data.perfiles;
      } else {
        const resPerfiles = await this.api.get('/perfiles');
        this.perfiles = resPerfiles.perfiles || [];
        if (Array.isArray(resPerfiles.modulos_matriz) && resPerfiles.modulos_matriz.length) {
          this.modulosMatriz = resPerfiles.modulos_matriz;
        }
      }

      this.sincronizarPerfilesConApp();
      this.renderMatrizPerfilesPorModulo();
      this.renderSelectoresDePerfiles();
      this.renderPersonal(this.personalActual);
      this.renderBitacora(data.bitacora || []);
    } catch (err) {
      this.notify(`Error al cargar personal y matriz de perfiles: ${err.message}`, 'error');
    }
  }

  sincronizarPerfilesConApp() {
    const app = window.petGroomingApp;
    if (app && app.session && Array.isArray(this.perfiles) && this.perfiles.length) {
      app.session.setPerfiles(this.perfiles);
      app.session.aplicarPermisosVisuales();
      if (typeof app.renderBotonesImpersonatePerfiles === 'function') {
        app.renderBotonesImpersonatePerfiles();
      }
    }
  }

  // =========================================================================
  // MATRIZ DE PERFILES Y PERMISOS POR MÓDULO (RENGLONES = PERFILES | COLUMNAS = ACTIVIDADES)
  // =========================================================================
  getModuloActivo() {
    return (
      this.modulosMatriz.find((m) => m.id === this.moduloActivoId) ||
      this.modulosMatriz[0]
    );
  }

  recalcularPermisosBooleanosDePerfil(perfil) {
    const niv = perfil.niveles || {};
    const esDueno = String(perfil.nombre || '').toLowerCase() === 'dueño';
    const tieneVisibilidad = (k) =>
      ['lectura', 'operacion', 'edicion_total'].includes(niv[k] || 'sin_acceso');
    const tieneOperacion = (k) =>
      ['operacion', 'edicion_total'].includes(niv[k] || 'sin_acceso');

    perfil.permisos = {
      ver_dashboard: tieneVisibilidad('dash_acceso_modulo'),
      ver_agenda: tieneVisibilidad('agenda_acceso_modulo'),
      ver_clientes: tieneVisibilidad('cli_acceso_padron_completo'),
      ver_inventario: tieneVisibilidad('inv_acceso_modulo'),
      ver_caja: tieneVisibilidad('caja_acceso_modulo'),
      ver_config: esDueno ? true : tieneVisibilidad('cfg_acceso_modulo'),
      buscar_clientes:
        tieneVisibilidad('cli_buscador_lateral') ||
        tieneVisibilidad('cli_expediente_perfil'),
      crear_clientes_mascotas:
        tieneOperacion('cli_alta_edicion_clientes') ||
        tieneOperacion('cli_alta_edicion_mascotas'),
      agendar_citas: tieneOperacion('agenda_crear_citas'),
      gestionar_asistencia_citas: tieneOperacion('agenda_asistencia_cobro'),
      gestionar_inventario:
        tieneOperacion('inv_catalogo_productos') ||
        tieneOperacion('inv_escaner_descuento') ||
        tieneOperacion('inv_escaner_venta'),
      registrar_caja: tieneOperacion('caja_movimientos_manuales'),
      editar_configuracion: esDueno
        ? true
        : tieneOperacion('cfg_horarios_plantilla') ||
          tieneOperacion('cfg_catalogo_servicios') ||
          tieneOperacion('cfg_gestion_personal') ||
          tieneOperacion('cfg_perfiles_permisos'),
      usar_impersonate: esDueno ? true : tieneOperacion('cfg_perfiles_permisos'),
    };
  }

  renderMatrizPerfilesPorModulo() {
    const selectEl = document.getElementById('perfiles-modulo-select');
    const tabsEl = document.getElementById('perfiles-modulo-tabs');
    const tituloModEl = document.getElementById('matriz-modulo-titulo-activo');
    const descModEl = document.getElementById('matriz-modulo-desc-activa');
    const theadEl = document.getElementById('matriz-perfiles-thead');
    const tbodyEl = document.getElementById('matriz-perfiles-tbody');

    if (!theadEl || !tbodyEl) return;

    const moduloActivo = this.getModuloActivo();
    if (!moduloActivo) return;

    // 1. Actualizar selector desplegable superior
    if (selectEl) {
      selectEl.innerHTML = this.modulosMatriz
        .map(
          (m) =>
            `<option value="${m.id}" ${
              m.id === moduloActivo.id ? 'selected' : ''
            }>${m.nombre} (${(m.actividades || []).length} actividades)</option>`
        )
        .join('');
    }

    // 2. Actualizar pestañas rápidas de módulos arriba de la tabla
    if (tabsEl) {
      tabsEl.innerHTML = this.modulosMatriz
        .map((m) => {
          const isAct = m.id === moduloActivo.id;
          return `
            <button type="button" data-modulo-tab="${m.id}"
              class="px-2.5 py-1.5 rounded-xl font-extrabold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
                isAct
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }">
              <i class="fa-solid ${m.icono || 'fa-cube'} text-[10px]"></i>
              <span>${m.nombre.split(',')[0]}</span>
            </button>
          `;
        })
        .join('');

      tabsEl.querySelectorAll('[data-modulo-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mid = btn.getAttribute('data-modulo-tab');
          if (mid) {
            this.moduloActivoId = mid;
            this.renderMatrizPerfilesPorModulo();
          }
        });
      });
    }

    if (tituloModEl) {
      tituloModEl.innerHTML = `<i class="fa-solid ${
        moduloActivo.icono || 'fa-layer-group'
      } text-blue-600 mr-1"></i>Módulo Activo: ${moduloActivo.nombre}`;
    }
    if (descModEl) {
      descModEl.textContent = `— ${moduloActivo.descripcion || ''}`;
    }

    const actividades = moduloActivo.actividades || [];

    // 3. Renderizar Encabezados de la Tabla (Columnas = Actividades del Módulo)
    theadEl.innerHTML = `
      <tr>
        <th class="py-3.5 px-4 bg-slate-950 text-left w-72 min-w-[260px] border-r border-slate-800 align-top">
          <div class="flex items-center gap-1.5 text-blue-400 font-extrabold uppercase tracking-wider text-[10px]">
            <i class="fa-solid fa-id-badge"></i>
            <span>Perfiles / Roles (Renglones)</span>
          </div>
          <p class="text-[10px] text-slate-400 font-normal mt-0.5">
            Define el nivel o marca las casillas de cada actividad para cada perfil
          </p>
        </th>
        ${actividades
          .map(
            (act) => `
            <th class="py-3 px-3.5 border-r border-slate-800/80 last:border-r-0 align-top min-w-[185px]">
              <div class="flex items-start justify-between gap-1.5">
                <span class="font-extrabold text-white text-xs leading-snug">${act.titulo}</span>
                ${
                  act.es_acceso_modulo
                    ? '<span class="px-1.5 py-0.5 rounded bg-blue-500/25 border border-blue-400/40 text-blue-200 text-[9px] font-extrabold shrink-0">Pestaña Menú</span>'
                    : ''
                }
              </div>
              <p class="text-[10px] text-slate-300/80 font-normal leading-tight mt-1">
                ${act.subtitulo || ''}
              </p>
            </th>
          `
          )
          .join('')}
      </tr>
    `;

    // 4. Renderizar Renglones de la Tabla (Cada renglón = Un Perfil)
    const iconPorPerfil = (nombre) => {
      const n = String(nombre || '').toLowerCase();
      if (n === 'dueño') return 'fa-crown text-purple-600';
      if (n === 'administrador') return 'fa-user-gear text-indigo-600';
      if (n === 'recepcionista') return 'fa-headset text-amber-600';
      if (n === 'cajero') return 'fa-cash-register text-emerald-600';
      if (n === 'estilista') return 'fa-scissors text-blue-600';
      return 'fa-user-tag text-slate-600';
    };

    const estiloCeldaPorNivel = (nivel) => {
      switch (nivel) {
        case 'edicion_total':
          return {
            bg: 'bg-indigo-50/55',
            selectBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          };
        case 'operacion':
          return {
            bg: 'bg-emerald-50/55',
            selectBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          };
        case 'lectura':
          return {
            bg: 'bg-blue-50/55',
            selectBg: 'bg-blue-100 text-blue-900 border-blue-300',
          };
        default:
          return {
            bg: 'bg-slate-50/70',
            selectBg: 'bg-slate-100 text-slate-600 border-slate-300',
          };
      }
    };

    tbodyEl.innerHTML = this.perfiles
      .map((perfil, pIdx) => {
        const esDueno = String(perfil.nombre || '').toLowerCase() === 'dueño';
        const nivelesPerfil = perfil.niveles || {};

        return `
          <tr class="hover:bg-slate-50/40 transition align-top" data-perfil-row="${pIdx}">
            <!-- Primera columna: Datos del Perfil y Acciones Rápidas de Renglón -->
            <td class="p-3.5 bg-white border-r border-slate-200 align-top">
              <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <i class="fa-solid ${iconPorPerfil(perfil.nombre)} text-xs"></i>
                  </span>
                  <span class="font-extrabold text-slate-900 text-xs truncate">${perfil.nombre}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    perfil.es_sistema
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-indigo-100 text-indigo-700'
                  }">${perfil.es_sistema ? 'Sistema' : 'Custom'}</span>
                </div>
                ${
                  !perfil.es_sistema
                    ? `<button type="button" data-delete-perfil="${perfil.nombre}" title="Eliminar este perfil personalizado"
                        class="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition cursor-pointer shrink-0">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                      </button>`
                    : ''
                }
              </div>

              <input type="text" data-perfil-desc="${pIdx}" value="${(
                perfil.descripcion || ''
              ).replace(/"/g, '&quot;')}"
                placeholder="Descripción del perfil..."
                class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />

              <!-- Botones rápidos para aplicar nivel a todo el renglón en este módulo -->
              <div class="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1">
                <span class="text-[9px] font-bold text-slate-400 uppercase mr-0.5">Renglón:</span>
                <button type="button" data-row-quick-level="edicion_total" data-row-idx="${pIdx}"
                  class="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[9px] transition cursor-pointer"
                  title="Marcar todas las actividades de este módulo como Edición Total">
                  Todo Edición
                </button>
                <button type="button" data-row-quick-level="operacion" data-row-idx="${pIdx}"
                  class="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[9px] transition cursor-pointer"
                  title="Marcar todas las actividades de este módulo como Operación">
                  Operación
                </button>
                <button type="button" data-row-quick-level="lectura" data-row-idx="${pIdx}"
                  class="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[9px] transition cursor-pointer"
                  title="Marcar todas las actividades de este módulo como Solo Visibilidad">
                  Visibilidad
                </button>
                ${
                  !esDueno
                    ? `<button type="button" data-row-quick-level="sin_acceso" data-row-idx="${pIdx}"
                        class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[9px] transition cursor-pointer"
                        title="Quitar acceso a todas las actividades de este módulo">
                        Sin Acceso
                      </button>`
                    : ''
                }
              </div>
            </td>

            <!-- Celdas de Intersección (Perfil × Actividad) con Selector de Nivel + Casillas de Selección -->
            ${actividades
              .map((act) => {
                const actKey = act.key;
                const nivelActual = nivelesPerfil[actKey] || 'sin_acceso';
                const bloqueadoDueno =
                  esDueno &&
                  (actKey === 'cfg_acceso_modulo' || actKey === 'cfg_perfiles_permisos');

                const chkVer = ['lectura', 'operacion', 'edicion_total'].includes(nivelActual);
                const chkOperar = ['operacion', 'edicion_total'].includes(nivelActual);
                const chkEditar = nivelActual === 'edicion_total';
                const st = estiloCeldaPorNivel(nivelActual);

                return `
                  <td class="p-2.5 border-r border-slate-200/80 last:border-r-0 ${st.bg} transition"
                      data-cell-perfil="${pIdx}" data-cell-act="${actKey}">
                    <!-- Selector directo del Nivel de Acceso -->
                    <select data-select-nivel="${pIdx}" data-act-key="${actKey}"
                      ${bloqueadoDueno ? 'disabled title="Fijo en Dueño para evitar bloqueo del sistema"' : ''}
                      class="w-full rounded-lg border px-2 py-1 text-[11px] font-extrabold ${
                        st.selectBg
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                      <option value="sin_acceso" ${
                        nivelActual === 'sin_acceso' ? 'selected' : ''
                      }>🚫 Sin Acceso</option>
                      <option value="lectura" ${
                        nivelActual === 'lectura' ? 'selected' : ''
                      }>👁️ Solo Visibilidad</option>
                      <option value="operacion" ${
                        nivelActual === 'operacion' ? 'selected' : ''
                      }>⚡ Creación / Operación</option>
                      <option value="edicion_total" ${
                        nivelActual === 'edicion_total' ? 'selected' : ''
                      }>🛡️ Edición Total</option>
                    </select>

                    <!-- Casillas de selección jerárquicas (Visibilidad / Operación / Edición Total) -->
                    <div class="mt-2 space-y-1 pl-0.5">
                      <label class="flex items-center gap-1.5 text-[10px] font-semibold ${
                        chkVer ? 'text-blue-900' : 'text-slate-400'
                      } cursor-pointer select-none">
                        <input type="checkbox"
                          class="chk-matriz-nivel rounded text-blue-600 w-3.5 h-3.5 cursor-pointer"
                          data-chk-perfil="${pIdx}"
                          data-chk-act="${actKey}"
                          data-chk-tier="lectura"
                          ${chkVer ? 'checked' : ''}
                          ${bloqueadoDueno ? 'disabled' : ''} />
                        <span>Visibilidad (Ver)</span>
                      </label>

                      <label class="flex items-center gap-1.5 text-[10px] font-semibold ${
                        chkOperar ? 'text-emerald-900' : 'text-slate-400'
                      } cursor-pointer select-none">
                        <input type="checkbox"
                          class="chk-matriz-nivel rounded text-emerald-600 w-3.5 h-3.5 cursor-pointer"
                          data-chk-perfil="${pIdx}"
                          data-chk-act="${actKey}"
                          data-chk-tier="operacion"
                          ${chkOperar ? 'checked' : ''}
                          ${bloqueadoDueno ? 'disabled' : ''} />
                        <span>Crear / Operar</span>
                      </label>

                      <label class="flex items-center gap-1.5 text-[10px] font-semibold ${
                        chkEditar ? 'text-indigo-900' : 'text-slate-400'
                      } cursor-pointer select-none">
                        <input type="checkbox"
                          class="chk-matriz-nivel rounded text-indigo-600 w-3.5 h-3.5 cursor-pointer"
                          data-chk-perfil="${pIdx}"
                          data-chk-act="${actKey}"
                          data-chk-tier="edicion_total"
                          ${chkEditar ? 'checked' : ''}
                          ${bloqueadoDueno ? 'disabled' : ''} />
                        <span>Edición Total</span>
                      </label>
                    </div>
                  </td>
                `;
              })
              .join('')}
          </tr>
        `;
      })
      .join('');

    this.bindEventosTablaMatriz();
  }

  bindEventosTablaMatriz() {
    const tbodyEl = document.getElementById('matriz-perfiles-tbody');
    if (!tbodyEl) return;

    // 1. Edición de descripción del perfil en la primera columna
    tbodyEl.querySelectorAll('[data-perfil-desc]').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.getAttribute('data-perfil-desc'));
        if (this.perfiles[idx]) {
          this.perfiles[idx].descripcion = input.value;
        }
      });
    });

    // 2. Cambio mediante el selector desplegable de nivel en una celda
    tbodyEl.querySelectorAll('[data-select-nivel]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const pIdx = Number(sel.getAttribute('data-select-nivel'));
        const actKey = sel.getAttribute('data-act-key');
        const nuevoNivel = sel.value || 'sin_acceso';
        this.actualizarNivelCelda(pIdx, actKey, nuevoNivel);
      });
    });

    // 3. Cambio mediante las casillas de selección (Visibilidad / Operación / Edición Total)
    tbodyEl.querySelectorAll('.chk-matriz-nivel').forEach((chk) => {
      chk.addEventListener('change', () => {
        const pIdx = Number(chk.getAttribute('data-chk-perfil'));
        const actKey = chk.getAttribute('data-chk-act');
        const tier = chk.getAttribute('data-chk-tier');
        const marcado = chk.checked;

        let nuevoNivel = 'sin_acceso';
        if (tier === 'edicion_total') {
          nuevoNivel = marcado ? 'edicion_total' : 'operacion';
        } else if (tier === 'operacion') {
          nuevoNivel = marcado ? 'operacion' : 'lectura';
        } else if (tier === 'lectura') {
          nuevoNivel = marcado ? 'lectura' : 'sin_acceso';
        }

        this.actualizarNivelCelda(pIdx, actKey, nuevoNivel);
      });
    });

    // 4. Botones rápidos de renglón (Todo Edición / Operación / Visibilidad / Sin Acceso en el módulo actual)
    tbodyEl.querySelectorAll('[data-row-quick-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pIdx = Number(btn.getAttribute('data-row-idx'));
        const nivel = btn.getAttribute('data-row-quick-level') || 'lectura';
        const modulo = this.getModuloActivo();
        const perfil = this.perfiles[pIdx];
        if (!perfil || !modulo) return;

        const esDueno = String(perfil.nombre || '').toLowerCase() === 'dueño';
        if (!perfil.niveles) perfil.niveles = {};

        (modulo.actividades || []).forEach((act) => {
          if (
            esDueno &&
            (act.key === 'cfg_acceso_modulo' || act.key === 'cfg_perfiles_permisos')
          ) {
            perfil.niveles[act.key] = 'edicion_total';
          } else {
            perfil.niveles[act.key] = nivel;
          }
        });

        this.recalcularPermisosBooleanosDePerfil(perfil);
        this.renderMatrizPerfilesPorModulo();
      });
    });

    // 5. Botón eliminar perfil personalizado
    tbodyEl.querySelectorAll('[data-delete-perfil]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nombre = btn.getAttribute('data-delete-perfil');
        if (nombre) {
          await this.eliminarPerfilPorNombre(nombre);
        }
      });
    });
  }

  actualizarNivelCelda(pIdx, actKey, nuevoNivel) {
    const perfil = this.perfiles[pIdx];
    if (!perfil || !actKey) return;

    if (!perfil.niveles) perfil.niveles = {};
    const esDueno = String(perfil.nombre || '').toLowerCase() === 'dueño';

    if (
      esDueno &&
      (actKey === 'cfg_acceso_modulo' || actKey === 'cfg_perfiles_permisos')
    ) {
      perfil.niveles[actKey] = 'edicion_total';
    } else {
      perfil.niveles[actKey] = nuevoNivel;
    }

    // Si el usuario habilita una actividad dentro de un módulo pero el acceso a la pestaña del módulo estaba en "sin_acceso",
    // activar automáticamente la pestaña del módulo en al menos "lectura" para que sea coherente
    const modulo = this.getModuloActivo();
    if (modulo && nuevoNivel !== 'sin_acceso') {
      const actAcceso = (modulo.actividades || []).find((a) => a.es_acceso_modulo);
      if (
        actAcceso &&
        actAcceso.key !== actKey &&
        (perfil.niveles[actAcceso.key] || 'sin_acceso') === 'sin_acceso'
      ) {
        perfil.niveles[actAcceso.key] = 'lectura';
      }
    }

    this.recalcularPermisosBooleanosDePerfil(perfil);
    this.renderMatrizPerfilesPorModulo();
  }

  async crearNuevoPerfilEnMatriz() {
    const inputNombre = document.getElementById('nuevo-perfil-nombre');
    const inputDesc = document.getElementById('nuevo-perfil-descripcion');
    const formCrear = document.getElementById('form-crear-nuevo-perfil');

    const nombre = (inputNombre?.value || '').trim();
    const descripcion = (inputDesc?.value || '').trim();

    if (!nombre || nombre.length < 2) {
      this.notify('Escribe un nombre válido para el nuevo perfil (mínimo 2 caracteres).', 'warning');
      return;
    }

    if (this.perfiles.some((p) => String(p.nombre).toLowerCase() === nombre.toLowerCase())) {
      this.notify(`Ya existe el perfil "${nombre}" en la tabla.`, 'warning');
      return;
    }

    const nivelesIniciales = {
      agenda_acceso_modulo: 'operacion',
      agenda_kpis_cobro_dia: 'lectura',
      agenda_crear_citas: 'operacion',
      agenda_asistencia_cobro: 'operacion',
      agenda_cancelar_editar: 'lectura',
      cli_acceso_padron_completo: 'sin_acceso',
      cli_buscador_lateral: 'operacion',
      cli_expediente_perfil: 'operacion',
      cli_alta_edicion_clientes: 'operacion',
      cli_alta_edicion_mascotas: 'operacion',
      dash_acceso_modulo: 'lectura',
      dash_kpis_financieros: 'sin_acceso',
      dash_graficas_operativas: 'lectura',
      dash_alertas_stock: 'lectura',
      inv_acceso_modulo: 'operacion',
      inv_catalogo_productos: 'lectura',
      inv_escaner_descuento: 'operacion',
      inv_escaner_venta: 'operacion',
      caja_acceso_modulo: 'sin_acceso',
      caja_movimientos_manuales: 'sin_acceso',
      caja_corte_turno: 'sin_acceso',
      cfg_acceso_modulo: 'sin_acceso',
      cfg_horarios_plantilla: 'sin_acceso',
      cfg_catalogo_servicios: 'sin_acceso',
      cfg_gestion_personal: 'sin_acceso',
      cfg_perfiles_permisos: 'sin_acceso',
    };

    try {
      const res = await this.api.post('/perfiles', {
        nombre,
        descripcion: descripcion || `Perfil personalizado: ${nombre}`,
        niveles: nivelesIniciales,
      });

      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }

      if (formCrear) {
        formCrear.reset();
        formCrear.classList.add('hidden');
      }

      this.sincronizarPerfilesConApp();
      this.renderMatrizPerfilesPorModulo();
      this.renderSelectoresDePerfiles();
      this.notify(
        `Perfil "${nombre}" agregado como nuevo renglón en la matriz. Ajusta sus niveles por módulo y guarda.`,
        'success'
      );
    } catch (err) {
      this.notify(`No se pudo crear el perfil: ${err.message}`, 'error');
    }
  }

  async guardarMatrizCompleta() {
    try {
      this.perfiles.forEach((p) => this.recalcularPermisosBooleanosDePerfil(p));
      const res = await this.api.put('/perfiles-matriz', {
        perfiles: this.perfiles,
      });

      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }
      this.sincronizarPerfilesConApp();
      this.renderMatrizPerfilesPorModulo();
      this.renderSelectoresDePerfiles();
      this.notify(
        res.mensaje || 'Matriz de permisos de todos los perfiles guardada correctamente.',
        'success'
      );
    } catch (err) {
      this.notify(`Error al guardar la matriz de permisos: ${err.message}`, 'error');
    }
  }

  async eliminarPerfilPorNombre(nombrePerfil) {
    const confirmar = window.confirm(
      `¿Eliminar el perfil personalizado "${nombrePerfil}" de la tabla?\nSolo se puede eliminar si ningún colaborador lo tiene asignado actualmente.`
    );
    if (!confirmar) return;

    try {
      const res = await this.api.delete(
        `/perfiles/${encodeURIComponent(nombrePerfil)}`
      );
      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }
      this.sincronizarPerfilesConApp();
      this.renderMatrizPerfilesPorModulo();
      this.renderSelectoresDePerfiles();
      this.notify(res.mensaje || `Perfil "${nombrePerfil}" eliminado.`, 'info');
    } catch (err) {
      this.notify(`No se pudo eliminar el perfil: ${err.message}`, 'error');
    }
  }

  renderSelectoresDePerfiles() {
    const selectAlta = document.getElementById('per-rol');
    const selectEdit = document.getElementById('edit-per-rol');
    if (!this.perfiles.length) return;

    const valAltaPrev = selectAlta?.value;
    const valEditPrev = selectEdit?.value;

    if (selectAlta) {
      selectAlta.innerHTML = this.perfiles
        .map((p) => {
          const modulosCount = [
            'ver_dashboard',
            'ver_agenda',
            'ver_clientes',
            'ver_inventario',
            'ver_caja',
            'ver_config',
          ].filter((k) => p.permisos && p.permisos[k]).length;
          return `<option value="${p.nombre}">${p.nombre} (${modulosCount} módulos)</option>`;
        })
        .join('');
      if (valAltaPrev && this.perfiles.some((p) => p.nombre === valAltaPrev)) {
        selectAlta.value = valAltaPrev;
      }
    }

    if (selectEdit) {
      selectEdit.innerHTML = this.perfiles
        .map((p) => `<option value="${p.nombre}">${p.nombre}</option>`)
        .join('');
      if (valEditPrev && this.perfiles.some((p) => p.nombre === valEditPrev)) {
        selectEdit.value = valEditPrev;
      }
    }
  }

  renderPersonal(usuarios) {
    const tbody = document.getElementById('personal-tbody');
    if (!tbody) return;

    if (!usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400 text-xs">Sin personal registrado.</td></tr>`;
      return;
    }

    const badgeRolColor = {
      'Dueño': 'bg-indigo-100 text-indigo-800',
      'Administrador': 'bg-purple-100 text-purple-800',
      'Cajero': 'bg-emerald-100 text-emerald-800',
      'Recepcionista': 'bg-teal-100 text-teal-800',
      'Estilista': 'bg-blue-100 text-blue-700',
    };

    tbody.innerHTML = usuarios
      .map(
        (u) => `
        <tr class="border-b border-slate-100 text-xs hover:bg-slate-50/70 transition">
          <td class="py-2.5 px-2">
            <div class="font-bold text-slate-800">${u.nombre}</div>
            <div class="text-[10px] text-slate-400">${u.sucursal_nombre || 'Sucursal Matriz'}</div>
          </td>
          <td class="py-2.5 px-2">
            <span class="px-2 py-0.5 rounded-full font-semibold ${
              badgeRolColor[u.rol] || 'bg-amber-100 text-amber-800'
            }">${u.rol}</span>
          </td>
          <td class="py-2.5 px-2">
            <span class="px-2 py-0.5 rounded-full font-semibold ${
              u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            }">${u.activo ? 'Activo' : 'Inactivo'}</span>
          </td>
          <td class="py-2.5 px-2 text-right whitespace-nowrap">
            <button type="button" data-edit-user="${u.id}" title="Editar perfil / rol / contraseña"
              class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-semibold transition mr-1">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button type="button" data-delete-user="${u.id}" title="Eliminar colaborador"
              class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-edit-user');
        this.abrirModalEditarPersonal(uid);
      });
    });

    tbody.querySelectorAll('[data-delete-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-delete-user');
        this.eliminarPersonal(uid);
      });
    });
  }

  abrirModalEditarPersonal(usuarioId) {
    const usr = this.personalActual.find((u) => String(u.id) === String(usuarioId));
    if (!usr) return;

    this.renderSelectoresDePerfiles();

    const modal = document.getElementById('modal-editar-personal');
    const idEl = document.getElementById('edit-per-id');
    const nomEl = document.getElementById('edit-per-nombre');
    const rolEl = document.getElementById('edit-per-rol');
    const actEl = document.getElementById('edit-per-activo');
    const sucEl = document.getElementById('edit-per-sucursal');
    const pinEl = document.getElementById('edit-per-pin');

    if (idEl) idEl.value = usr.id;
    if (nomEl) nomEl.value = usr.nombre || '';
    if (rolEl) {
      if (!Array.from(rolEl.options).some((opt) => opt.value === usr.rol)) {
        const opt = document.createElement('option');
        opt.value = usr.rol;
        opt.textContent = usr.rol;
        rolEl.appendChild(opt);
      }
      rolEl.value = usr.rol || 'Estilista';
    }
    if (actEl) actEl.value = usr.activo !== false ? 'true' : 'false';
    if (pinEl) pinEl.value = '';

    if (sucEl) {
      if (this.sucursalesOrg.length) {
        sucEl.innerHTML = this.sucursalesOrg
          .map(
            (s) =>
              `<option value="${s.id}" ${
                s.id === usr.sucursal_id ? 'selected' : ''
              }>${s.nombre}</option>`
          )
          .join('');
      } else {
        sucEl.innerHTML = `<option value="${usr.sucursal_id || ''}">${
          usr.sucursal_nombre || 'Sucursal Actual'
        }</option>`;
      }
    }

    if (modal) modal.classList.remove('hidden');
  }

  cerrarModalEditarPersonal() {
    document.getElementById('modal-editar-personal')?.classList.add('hidden');
  }

  async guardarEdicionPersonal() {
    const usuarioId = document.getElementById('edit-per-id')?.value;
    const nombre = document.getElementById('edit-per-nombre')?.value.trim();
    const rol = document.getElementById('edit-per-rol')?.value || 'Estilista';
    const activo = document.getElementById('edit-per-activo')?.value === 'true';
    const nueva_sucursal_id = document.getElementById('edit-per-sucursal')?.value || undefined;
    const pin = document.getElementById('edit-per-pin')?.value.trim();

    if (!usuarioId || !nombre) {
      this.notify('El nombre de usuario no puede estar vacío.', 'warning');
      return;
    }

    try {
      const payload = {
        nombre,
        rol,
        activo,
        nueva_sucursal_id,
      };
      if (pin) {
        payload.pin = pin;
      }

      const res = await this.api.put(`/personal/${usuarioId}`, payload);
      this.notify(res.mensaje || 'Colaborador actualizado.', 'success');
      this.cerrarModalEditarPersonal();
      await this.cargarPersonalYBitacora();
    } catch (err) {
      this.notify(`Error al actualizar colaborador: ${err.message}`, 'error');
    }
  }

  async eliminarPersonal(usuarioId) {
    const usr = this.personalActual.find((u) => String(u.id) === String(usuarioId));
    if (!usr) return;

    const confirmar = window.confirm(
      `¿Estás seguro de eliminar al colaborador "${usr.nombre}" (${usr.rol})?\nEsta acción revocará su acceso de forma permanente.`
    );
    if (!confirmar) return;

    try {
      const res = await this.api.delete(`/personal/${usuarioId}`);
      this.notify(res.mensaje || `Colaborador ${usr.nombre} eliminado.`, 'info');
      await this.cargarPersonalYBitacora();
    } catch (err) {
      this.notify(`No se pudo eliminar: ${err.message}`, 'error');
    }
  }

  async crearPersonal() {
    const nombre = document.getElementById('per-nombre')?.value.trim();
    const rol = document.getElementById('per-rol')?.value || 'Estilista';
    const pin = document.getElementById('per-pin')?.value.trim();

    if (!nombre || !pin || pin.length < 3) {
      this.notify('Ingresa usuario y una contraseña de al menos 3 caracteres.', 'warning');
      return;
    }

    try {
      await this.api.post('/personal', {
        nombre,
        rol,
        pin,
        activo: true,
      });
      this.notify(`Colaborador ${nombre} (${rol}) dado de alta.`, 'success');
      document.getElementById('form-crear-personal')?.reset();
      await this.cargarPersonalYBitacora();
    } catch (err) {
      this.notify(`Error al registrar personal: ${err.message}`, 'error');
    }
  }

  renderBitacora(eventos) {
    const tbody = document.getElementById('bitacora-tbody');
    if (!tbody) return;

    if (!eventos.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400 text-xs">Sin registros en bitácora.</td></tr>`;
      return;
    }

    tbody.innerHTML = eventos
      .slice(0, 25)
      .map((ev) => {
        const fechaFmt = ev.fecha
          ? new Date(ev.fecha).toLocaleString('es-MX', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '-';
        return `
          <tr class="border-b border-slate-100 text-xs">
            <td class="py-2 px-2 text-slate-500 whitespace-nowrap">${fechaFmt}</td>
            <td class="py-2 px-2 font-semibold text-slate-700">${ev.usuario_nombre} (${ev.rol})</td>
            <td class="py-2 px-2">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">${ev.accion}</span>
            </td>
            <td class="py-2 px-2 text-slate-600">${ev.detalle || '-'}</td>
          </tr>`;
      })
      .join('');
  }
}
