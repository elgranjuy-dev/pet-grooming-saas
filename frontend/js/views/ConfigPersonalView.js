/**
 * ConfigPersonalView.js
 * Vista POO para Configuración de Agenda (intervalo, plantilla semanal, catálogo de servicios,
 * excepciones/bloqueos), alta de Personal y Bitácora de Auditoría / Asistencias.
 */
export class ConfigPersonalView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.plantillaActual = [];
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
  }

  async load() {
    await Promise.all([this.cargarAgendaConfig(), this.cargarPersonalYBitacora()]);
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
      this.renderPersonal(data.personal || []);
      this.renderBitacora(data.bitacora || []);
    } catch (err) {
      this.notify(`Error al cargar personal: ${err.message}`, 'error');
    }
  }

  renderPersonal(usuarios) {
    const tbody = document.getElementById('personal-tbody');
    if (!tbody) return;

    if (!usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400 text-xs">Sin personal registrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = usuarios
      .map(
        (u) => `
        <tr class="border-b border-slate-100 text-xs">
          <td class="py-2.5 px-3 font-semibold text-slate-800">${u.nombre}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">${u.rol}</span>
          </td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full ${
              u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            }">${u.activo ? 'Activo' : 'Inactivo'}</span>
          </td>
        </tr>`
      )
      .join('');
  }

  async crearPersonal() {
    const nombre = document.getElementById('per-nombre')?.value.trim();
    const rol = document.getElementById('per-rol')?.value || 'Estilista';
    const pin = document.getElementById('per-pin')?.value.trim();

    if (!nombre || !pin || pin.length < 4) {
      this.notify('Ingresa nombre y un PIN de al menos 4 dígitos.', 'warning');
      return;
    }

    try {
      await this.api.post('/personal', {
        nombre,
        rol,
        pin,
        activo: true,
      });
      this.notify(`Colaborador ${nombre} dado de alta.`, 'success');
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
