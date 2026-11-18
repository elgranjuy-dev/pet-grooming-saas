/**
 * ConfigPersonalView.js
 * Vista POO para Configuración de Agenda (intervalo, plantilla semanal, catálogo de servicios,
 * excepciones/bloqueos), Gestión de Perfiles y Permisos (casillas de selección ver/hacer por perfil),
 * gestión de Personal (alta, edición de perfil/rol/contraseña y eliminación) y Bitácora de Auditoría.
 */
export class ConfigPersonalView {
  static DEFAULT_CATALOGO_PERMISOS = [
    {
      key: 'ver_dashboard',
      grupo: 'ver',
      titulo: 'Ver módulo Dashboard',
      descripcion: 'Acceso a KPIs financieros, gráficas e indicadores de la sucursal.',
    },
    {
      key: 'ver_agenda',
      grupo: 'ver',
      titulo: 'Ver módulo Agenda y Turnos',
      descripcion: 'Acceso al calendario diario/semanal, bloques de horario y tarjetas de citas.',
    },
    {
      key: 'ver_clientes',
      grupo: 'ver',
      titulo: 'Ver módulo Clientes y Expedientes (Base de Datos)',
      descripcion: 'Acceso a la tabla completa de clientes y mascotas con filtros por columna.',
    },
    {
      key: 'ver_inventario',
      grupo: 'ver',
      titulo: 'Ver módulo Inventario y Escáner',
      descripcion: 'Acceso al catálogo de productos, existencias y terminal de códigos de barras.',
    },
    {
      key: 'ver_caja',
      grupo: 'ver',
      titulo: 'Ver módulo Caja y Cobros',
      descripcion: 'Acceso al registro de ingresos del día, cobros por método y movimientos.',
    },
    {
      key: 'ver_config',
      grupo: 'ver',
      titulo: 'Ver módulo Configuración y Personal',
      descripcion: 'Acceso a horarios, catálogo de servicios, personal, perfiles y bitácora.',
    },
    {
      key: 'buscar_clientes',
      grupo: 'hacer',
      titulo: 'Buscar clientes y consultar expedientes',
      descripcion: 'Usar la barra de búsqueda del menú lateral para abrir perfiles de clientes y mascotas.',
    },
    {
      key: 'crear_clientes_mascotas',
      grupo: 'hacer',
      titulo: 'Registrar nuevos clientes y agregar mascotas',
      descripcion: 'Dar de alta dueños desde el menú lateral y agregar mascotas dentro de su perfil.',
    },
    {
      key: 'agendar_citas',
      grupo: 'hacer',
      titulo: 'Agendar nuevas citas',
      descripcion: 'Crear citas haciendo clic en bloques disponibles o desde la ficha de una mascota.',
    },
    {
      key: 'gestionar_asistencia_citas',
      grupo: 'hacer',
      titulo: 'Marcar Asistió / No Asistió y cobrar citas',
      descripcion: 'Confirmar asistencia de mascotas en la agenda, registrar cobro o marcar inasistencia.',
    },
    {
      key: 'gestionar_inventario',
      grupo: 'hacer',
      titulo: 'Agregar productos y operar escáner de inventario',
      descripcion: 'Registrar nuevos productos/insumos y descontar o vender con código de barras.',
    },
    {
      key: 'registrar_caja',
      grupo: 'hacer',
      titulo: 'Registrar ingresos manuales en Caja',
      descripcion: 'Capturar cobros manuales y conceptos adicionales en el módulo de Caja.',
    },
    {
      key: 'editar_configuracion',
      grupo: 'hacer',
      titulo: 'Modificar configuración, personal y perfiles',
      descripcion: 'Editar horarios, servicios, excepciones, colaboradores y permisos de perfiles.',
    },
    {
      key: 'usar_impersonate',
      grupo: 'hacer',
      titulo: 'Usar Modo Impersonate (Simular perfiles/usuarios)',
      descripcion: 'Cambiar temporalmente de vista para auditar cómo opera otro perfil o colaborador.',
    },
  ];

  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.plantillaActual = [];
    this.personalActual = [];
    this.sucursalesOrg = [];
    this.perfiles = [];
    this.catalogoPermisos = ConfigPersonalView.DEFAULT_CATALOGO_PERMISOS;
    this.perfilSeleccionadoNombre = 'Recepcionista';
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

    this.initEventosPerfilesPermisos();
  }

  initEventosPerfilesPermisos() {
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
        await this.crearNuevoPerfil();
      });
    }

    const btnMarcarTodo = document.getElementById('btn-perfil-marcar-todo');
    if (btnMarcarTodo) {
      btnMarcarTodo.addEventListener('click', () => this.marcarCasillasPerfilActual(true));
    }

    const btnDesmarcarTodo = document.getElementById('btn-perfil-desmarcar-todo');
    if (btnDesmarcarTodo) {
      btnDesmarcarTodo.addEventListener('click', () => this.marcarCasillasPerfilActual(false));
    }

    const btnGuardarPermisos = document.getElementById('btn-guardar-permisos-perfil');
    if (btnGuardarPermisos) {
      btnGuardarPermisos.addEventListener('click', async () => {
        await this.guardarPermisosPerfilSeleccionado();
      });
    }

    const btnEliminarPerfil = document.getElementById('btn-perfil-eliminar');
    if (btnEliminarPerfil) {
      btnEliminarPerfil.addEventListener('click', async () => {
        await this.eliminarPerfilSeleccionado();
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

      if (Array.isArray(data.catalogo_permisos) && data.catalogo_permisos.length) {
        this.catalogoPermisos = data.catalogo_permisos;
      }

      if (Array.isArray(data.perfiles) && data.perfiles.length) {
        this.perfiles = data.perfiles;
      } else {
        const resPerfiles = await this.api.get('/perfiles');
        this.perfiles = resPerfiles.perfiles || [];
        if (Array.isArray(resPerfiles.catalogo_permisos) && resPerfiles.catalogo_permisos.length) {
          this.catalogoPermisos = resPerfiles.catalogo_permisos;
        }
      }

      this.sincronizarPerfilesConApp();
      this.renderPerfilesYPermisos();
      this.renderSelectoresDePerfiles();
      this.renderPersonal(this.personalActual);
      this.renderBitacora(data.bitacora || []);
    } catch (err) {
      this.notify(`Error al cargar personal y perfiles: ${err.message}`, 'error');
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
  // MÓDULO DE GESTIÓN DE PERFILES Y PERMISOS (CASILLAS DE SELECCIÓN)
  // =========================================================================
  getPerfilSeleccionado() {
    if (!this.perfiles.length) return null;
    const found = this.perfiles.find(
      (p) => String(p.nombre || '').toLowerCase() === String(this.perfilSeleccionadoNombre || '').toLowerCase()
    );
    if (found) return found;
    this.perfilSeleccionadoNombre = this.perfiles[0].nombre;
    return this.perfiles[0];
  }

  renderPerfilesYPermisos() {
    const listaEl = document.getElementById('cfg-perfiles-lista');
    if (!listaEl) return;

    const perfilActivo = this.getPerfilSeleccionado();
    const totalCatalogo = this.catalogoPermisos.length || 14;

    const iconPorPerfil = (nombre) => {
      const n = String(nombre || '').toLowerCase();
      if (n === 'dueño') return 'fa-crown text-purple-600';
      if (n === 'administrador') return 'fa-user-gear text-indigo-600';
      if (n === 'recepcionista') return 'fa-headset text-amber-600';
      if (n === 'cajero') return 'fa-cash-register text-emerald-600';
      if (n === 'estilista') return 'fa-scissors text-blue-600';
      return 'fa-id-badge text-slate-600';
    };

    listaEl.innerHTML = this.perfiles
      .map((p) => {
        const esSeleccionado =
          perfilActivo && String(p.nombre).toLowerCase() === String(perfilActivo.nombre).toLowerCase();
        const activosCount = Object.values(p.permisos || {}).filter(Boolean).length;

        return `
          <button type="button" data-select-perfil="${p.nombre}"
            class="w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-2 cursor-pointer ${
              esSeleccionado
                ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/40'
                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
            }">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid ${iconPorPerfil(p.nombre)} text-xs"></i>
                <span class="font-extrabold text-slate-900 truncate">${p.nombre}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  p.es_sistema
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-indigo-100 text-indigo-700'
                }">${p.es_sistema ? 'Sistema' : 'Personalizado'}</span>
              </div>
              <p class="text-[11px] text-slate-500 line-clamp-1 mt-0.5">${
                p.descripcion || 'Sin descripción'
              }</p>
            </div>
            <div class="shrink-0 text-right">
              <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                esSeleccionado
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }">
                ${activosCount}/${totalCatalogo}
              </span>
              <p class="text-[9px] text-slate-400 mt-0.5">permisos</p>
            </div>
          </button>
        `;
      })
      .join('');

    listaEl.querySelectorAll('[data-select-perfil]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nom = btn.getAttribute('data-select-perfil');
        if (nom) {
          this.perfilSeleccionadoNombre = nom;
          this.renderPerfilesYPermisos();
        }
      });
    });

    if (perfilActivo) {
      this.renderEditorPermisosDePerfil(perfilActivo);
    }
  }

  renderEditorPermisosDePerfil(perfil) {
    const nomEl = document.getElementById('perfil-editor-nombre');
    const badgeEl = document.getElementById('perfil-editor-badge');
    const descEl = document.getElementById('perfil-editor-descripcion');
    const btnEliminar = document.getElementById('btn-perfil-eliminar');
    const contVer = document.getElementById('perfil-checkboxes-ver');
    const contHacer = document.getElementById('perfil-checkboxes-hacer');

    if (nomEl) nomEl.textContent = perfil.nombre;
    if (descEl) descEl.value = perfil.descripcion || '';

    if (badgeEl) {
      if (perfil.protegido) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800';
        badgeEl.textContent = 'Perfil Propietario';
      } else if (perfil.es_sistema) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800';
        badgeEl.textContent = 'Perfil Base Editable';
      } else {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800';
        badgeEl.textContent = 'Perfil Personalizado';
      }
    }

    if (btnEliminar) {
      btnEliminar.classList.toggle('hidden', Boolean(perfil.es_sistema));
    }

    const permisosMap = perfil.permisos || {};
    const esDueno = String(perfil.nombre || '').toLowerCase() === 'dueño';

    const renderCasilla = (item) => {
      const checked = Boolean(permisosMap[item.key]);
      const bloqueadoPorSeguridad =
        esDueno && (item.key === 'ver_config' || item.key === 'editar_configuracion');

      return `
        <label class="flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
          checked
            ? 'border-blue-500/70 bg-blue-50/40 hover:bg-blue-50/70'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        }">
          <input type="checkbox"
            class="perfil-permiso-checkbox mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            data-permiso-key="${item.key}"
            ${checked ? 'checked' : ''}
            ${bloqueadoPorSeguridad ? 'disabled title="El Dueño siempre conserva acceso a Configuración para evitar bloqueo"' : ''} />
          <div class="min-w-0 flex-1">
            <div class="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
              <span>${item.titulo}</span>
              ${
                bloqueadoPorSeguridad
                  ? '<span class="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 text-[9px] font-bold">Fijo en Dueño</span>'
                  : ''
              }
            </div>
            <p class="text-[11px] text-slate-500 leading-snug mt-0.5">${item.descripcion}</p>
          </div>
        </label>
      `;
    };

    const itemsVer = this.catalogoPermisos.filter((x) => x.grupo === 'ver');
    const itemsHacer = this.catalogoPermisos.filter((x) => x.grupo === 'hacer');

    if (contVer) {
      contVer.innerHTML = itemsVer.map(renderCasilla).join('');
    }
    if (contHacer) {
      contHacer.innerHTML = itemsHacer.map(renderCasilla).join('');
    }

    // Actualizar estilo visual de cada tarjeta al marcar/desmarcar una casilla
    document.querySelectorAll('.perfil-permiso-checkbox').forEach((chk) => {
      chk.addEventListener('change', () => {
        const label = chk.closest('label');
        if (!label) return;
        if (chk.checked) {
          label.className =
            'flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none border-blue-500/70 bg-blue-50/40 hover:bg-blue-50/70';
        } else {
          label.className =
            'flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none border-slate-200 bg-white hover:bg-slate-50';
        }
      });
    });
  }

  marcarCasillasPerfilActual(estadoBooleano) {
    const perfil = this.getPerfilSeleccionado();
    const esDueno = perfil && String(perfil.nombre).toLowerCase() === 'dueño';

    document.querySelectorAll('.perfil-permiso-checkbox').forEach((chk) => {
      const key = chk.getAttribute('data-permiso-key');
      if (esDueno && (key === 'ver_config' || key === 'editar_configuracion')) {
        chk.checked = true;
      } else if (!estadoBooleano && key === 'ver_agenda') {
        // Dejar al menos Agenda marcada al limpiar para que siempre exista un módulo visible
        chk.checked = true;
      } else {
        chk.checked = Boolean(estadoBooleano);
      }
      chk.dispatchEvent(new Event('change'));
    });
  }

  recolectarPermisosDeCasillas() {
    const permisos = {};
    document.querySelectorAll('.perfil-permiso-checkbox').forEach((chk) => {
      const key = chk.getAttribute('data-permiso-key');
      if (key) {
        permisos[key] = Boolean(chk.checked);
      }
    });
    return permisos;
  }

  async crearNuevoPerfil() {
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
      this.notify(`Ya existe un perfil llamado "${nombre}". Selecciónalo en la lista para editarlo.`, 'warning');
      return;
    }

    // Permisos iniciales sugeridos para un nuevo perfil operativo
    const permisosIniciales = {
      ver_dashboard: false,
      ver_agenda: true,
      ver_clientes: false,
      ver_inventario: true,
      ver_caja: false,
      ver_config: false,
      buscar_clientes: true,
      crear_clientes_mascotas: true,
      agendar_citas: true,
      gestionar_asistencia_citas: true,
      gestionar_inventario: false,
      registrar_caja: false,
      editar_configuracion: false,
      usar_impersonate: false,
    };

    try {
      const res = await this.api.post('/perfiles', {
        nombre,
        descripcion: descripcion || `Perfil personalizado: ${nombre}`,
        permisos: permisosIniciales,
      });

      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }
      this.perfilSeleccionadoNombre = res.perfil?.nombre || nombre;

      if (formCrear) {
        formCrear.reset();
        formCrear.classList.add('hidden');
      }

      this.sincronizarPerfilesConApp();
      this.renderPerfilesYPermisos();
      this.renderSelectoresDePerfiles();
      this.notify(
        `Perfil "${this.perfilSeleccionadoNombre}" creado. Ahora puedes marcar o desmarcar sus casillas de permisos.`,
        'success'
      );
    } catch (err) {
      this.notify(`No se pudo crear el perfil: ${err.message}`, 'error');
    }
  }

  async guardarPermisosPerfilSeleccionado() {
    const perfil = this.getPerfilSeleccionado();
    if (!perfil) return;

    const descripcion =
      document.getElementById('perfil-editor-descripcion')?.value.trim() ||
      perfil.descripcion ||
      '';
    const permisos = this.recolectarPermisosDeCasillas();

    const tieneAlMenosUnModulo = [
      'ver_dashboard',
      'ver_agenda',
      'ver_clientes',
      'ver_inventario',
      'ver_caja',
      'ver_config',
    ].some((k) => Boolean(permisos[k]));

    if (!tieneAlMenosUnModulo) {
      this.notify(
        'Selecciona al menos una casilla en "¿Qué módulos puede VER este perfil en el menú?".',
        'warning'
      );
      return;
    }

    try {
      const res = await this.api.put(
        `/perfiles/${encodeURIComponent(perfil.nombre)}`,
        {
          nombre: perfil.nombre,
          descripcion,
          permisos,
        }
      );

      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }
      this.sincronizarPerfilesConApp();
      this.renderPerfilesYPermisos();
      this.renderSelectoresDePerfiles();
      this.notify(
        res.mensaje || `Permisos del perfil "${perfil.nombre}" actualizados.`,
        'success'
      );
    } catch (err) {
      this.notify(`Error al guardar permisos del perfil: ${err.message}`, 'error');
    }
  }

  async eliminarPerfilSeleccionado() {
    const perfil = this.getPerfilSeleccionado();
    if (!perfil || perfil.es_sistema) return;

    const confirmar = window.confirm(
      `¿Eliminar el perfil personalizado "${perfil.nombre}"?\nSolo se puede eliminar si ningún colaborador lo tiene asignado actualmente.`
    );
    if (!confirmar) return;

    try {
      const res = await this.api.delete(
        `/perfiles/${encodeURIComponent(perfil.nombre)}`
      );
      if (Array.isArray(res.perfiles)) {
        this.perfiles = res.perfiles;
      }
      this.perfilSeleccionadoNombre = this.perfiles[0]?.nombre || 'Recepcionista';
      this.sincronizarPerfilesConApp();
      this.renderPerfilesYPermisos();
      this.renderSelectoresDePerfiles();
      this.notify(res.mensaje || `Perfil "${perfil.nombre}" eliminado.`, 'info');
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
