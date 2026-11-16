/**
 * AgendaView.js
 * Vista POO para consulta de disponibilidad inteligente (AvailabilityEngine),
 * agendamiento de citas y cobro / cierre de citas completadas.
 */
export class AgendaView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.selectedSlot = null;
    this.selectedMascota = null;
    this.serviciosCatalogo = [];
    this.estilistasSucursal = [];
  }

  init() {
    const today = new Date().toISOString().slice(0, 10);
    const fechaInput = document.getElementById('agenda-fecha');
    const filtroFecha = document.getElementById('citas-filtro-fecha');
    if (fechaInput && !fechaInput.value) fechaInput.value = today;
    if (filtroFecha && !filtroFecha.value) filtroFecha.value = today;

    // Buscar mascota para agendar cita
    const btnBuscarMascota = document.getElementById('btn-agenda-buscar-mascota');
    if (btnBuscarMascota) {
      btnBuscarMascota.addEventListener('click', () => this.buscarMascotaParaCita());
    }

    // Consultar disponibilidad con AvailabilityEngine
    const btnDisponibilidad = document.getElementById('btn-consultar-disponibilidad');
    if (btnDisponibilidad) {
      btnDisponibilidad.addEventListener('click', () => this.consultarDisponibilidad());
    }

    // Cambio en selector de servicio actualiza duración y precio sugerido
    const selectServicio = document.getElementById('agenda-servicio-select');
    if (selectServicio) {
      selectServicio.addEventListener('change', (e) => {
        const srv = this.serviciosCatalogo.find((s) => s.nombre === e.target.value);
        if (srv) {
          const durInput = document.getElementById('agenda-duracion');
          const precioInput = document.getElementById('agenda-precio');
          if (durInput) durInput.value = srv.duracion_minutos || 60;
          if (precioInput) precioInput.value = srv.precio_base || 0;
          this.consultarDisponibilidad();
        }
      });
    }

    // Formulario de creación de cita
    const formCita = document.getElementById('form-crear-cita');
    if (formCita) {
      formCita.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearCita();
      });
    }

    // Filtro de citas
    const btnFiltrarCitas = document.getElementById('btn-filtrar-citas');
    if (btnFiltrarCitas) {
      btnFiltrarCitas.addEventListener('click', () => this.cargarCitas());
    }
  }

  async load() {
    await Promise.all([
      this.cargarCatalogosAgenda(),
      this.consultarDisponibilidad(),
      this.cargarCitas(),
    ]);
  }

  async cargarCatalogosAgenda() {
    try {
      const [agendaCfg, personalData] = await Promise.all([
        this.api.get('/agenda-config'),
        this.api.get('/personal'),
      ]);

      this.serviciosCatalogo = (agendaCfg.servicios_catalogo || []).filter(
        (s) => s.activo !== false
      );
      this.estilistasSucursal = (personalData.personal || []).filter(
        (u) => u.activo !== false
      );

      const selectServicio = document.getElementById('agenda-servicio-select');
      if (selectServicio) {
        if (this.serviciosCatalogo.length) {
          selectServicio.innerHTML = this.serviciosCatalogo
            .map(
              (s) =>
                `<option value="${s.nombre}" data-duracion="${s.duracion_minutos}" data-precio="${s.precio_base}">
                  ${s.nombre} (${s.duracion_minutos} min - $${s.precio_base})
                </option>`
            )
            .join('');
          const first = this.serviciosCatalogo[0];
          const durInput = document.getElementById('agenda-duracion');
          const precioInput = document.getElementById('agenda-precio');
          if (durInput) durInput.value = first.duracion_minutos || 60;
          if (precioInput) precioInput.value = first.precio_base || 0;
        } else {
          selectServicio.innerHTML = `<option value="Baño y Corte Completo">Baño y Corte Completo (60 min)</option>`;
        }
      }

      const selectEstilista = document.getElementById('agenda-estilista');
      if (selectEstilista) {
        const opciones = [
          '<option value="Por asignar">Por asignar (Automático)</option>',
          ...this.estilistasSucursal.map(
            (u) => `<option value="${u.nombre}">${u.nombre} (${u.rol})</option>`
          ),
        ];
        selectEstilista.innerHTML = opciones.join('');
      }
    } catch (err) {
      console.warn('Error cargando catálogos de agenda:', err);
    }
  }

  async buscarMascotaParaCita() {
    const input = document.getElementById('agenda-buscar-mascota-input');
    const container = document.getElementById('agenda-mascota-resultados');
    if (!input || !container) return;

    const q = input.value.trim();
    if (q.length < 2) {
      this.notify('Ingresa al menos 2 caracteres (teléfono, cliente, mascota o PET-)', 'warning');
      return;
    }

    try {
      const data = await this.api.get('/clientes/buscar', { q });
      const clientes = data.resultados || [];
      const mascotasLista = [];

      clientes.forEach((cli) => {
        (cli.mascotas || []).forEach((m) => {
          mascotasLista.push({
            ...m,
            cliente_nombre: cli.nombre,
            cliente_telefono: cli.telefono,
          });
        });
      });

      if (!mascotasLista.length) {
        container.innerHTML = `
          <p class="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            No se encontraron mascotas. Regístrala primero en la pestaña "Clientes y Expedientes".
          </p>`;
        return;
      }

      container.innerHTML = mascotasLista
        .map(
          (m) => `
          <button type="button"
            data-mascota-id="${m.id}"
            data-mascota-nombre="${m.nombre}"
            data-mascota-raza="${m.raza}"
            data-cliente-nombre="${m.cliente_nombre}"
            class="btn-select-mascota-cita w-full text-left p-2 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-slate-800">${m.nombre}</span>
              <span class="text-slate-500">(${m.raza})</span>
              <p class="text-[11px] text-slate-500">Dueño: ${m.cliente_nombre} · ${m.cliente_telefono}</p>
            </div>
            <span class="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-blue-700">${m.codigo_barras || 'Sin código'}</span>
          </button>`
        )
        .join('');

      container.querySelectorAll('.btn-select-mascota-cita').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-mascota-id');
          const nombre = btn.getAttribute('data-mascota-nombre');
          const raza = btn.getAttribute('data-mascota-raza');
          const dueno = btn.getAttribute('data-cliente-nombre');
          this.selectedMascota = { id, nombre, raza, dueno };
          const hiddenId = document.getElementById('agenda-mascota-id');
          const badge = document.getElementById('agenda-mascota-seleccionada');
          if (hiddenId) hiddenId.value = id;
          if (badge) {
            badge.textContent = `Seleccionada: ${nombre} (${raza}) - Dueño: ${dueno}`;
            badge.classList.remove('hidden');
          }
        });
      });
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  async consultarDisponibilidad() {
    const fechaInput = document.getElementById('agenda-fecha');
    const durInput = document.getElementById('agenda-duracion');
    const slotsContainer = document.getElementById('agenda-slots-container');
    if (!fechaInput || !slotsContainer) return;

    const fecha = fechaInput.value || new Date().toISOString().slice(0, 10);
    const duracion_minutos = Number((durInput && durInput.value) || 60);

    try {
      const data = await this.api.get('/disponibilidad', {
        fecha,
        duracion_minutos,
      });

      if (!data.abierto) {
        slotsContainer.innerHTML = `
          <div class="col-span-full p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <i class="fa-solid fa-calendar-xmark mr-1"></i>
            <strong>Sucursal cerrada:</strong> ${data.motivo_cierre || 'Día inhábil'}
          </div>`;
        return;
      }

      const slots = data.slots || [];
      if (!slots.length) {
        slotsContainer.innerHTML = `
          <div class="col-span-full p-3 text-sm text-slate-500">
            No hay bloques configurados para este día.
          </div>`;
        return;
      }

      slotsContainer.innerHTML = slots
        .map((s) => {
          const disabled = !s.disponible ? 'disabled' : '';
          const classes = s.disponible
            ? 'bg-white border-slate-200 text-slate-800 hover:border-blue-500 cursor-pointer'
            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60';
          return `
            <button type="button" ${disabled}
              data-hora="${s.hora}"
              class="slot-chip border rounded-lg p-2 text-center ${classes}">
              <div class="font-bold text-sm">${s.hora}</div>
              <div class="text-[10px] ${s.disponible ? 'text-emerald-600' : 'text-red-500'}">
                ${s.disponible ? `${s.cupos_disponibles} cupo(s)` : 'Agotado'}
              </div>
              ${
                s.en_horario_comida
                  ? '<div class="text-[9px] text-amber-600"><i class="fa-solid fa-utensils"></i> Comida</div>'
                  : ''
              }
            </button>`;
        })
        .join('');

      slotsContainer.querySelectorAll('.slot-chip:not(:disabled)').forEach((btn) => {
        btn.addEventListener('click', () => {
          slotsContainer
            .querySelectorAll('.slot-chip')
            .forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.selectedSlot = btn.getAttribute('data-hora');
          const horaInput = document.getElementById('agenda-hora-seleccionada');
          if (horaInput) horaInput.value = this.selectedSlot;
        });
      });
    } catch (err) {
      this.notify(`Error al calcular disponibilidad: ${err.message}`, 'error');
    }
  }

  async crearCita() {
    const mascotaId = document.getElementById('agenda-mascota-id')?.value;
    const fecha = document.getElementById('agenda-fecha')?.value;
    const hora = document.getElementById('agenda-hora-seleccionada')?.value || this.selectedSlot;
    const servicio = document.getElementById('agenda-servicio-select')?.value || 'Baño Básico';
    const duracion = Number(document.getElementById('agenda-duracion')?.value || 60);
    const precio = Number(document.getElementById('agenda-precio')?.value || 0);
    const estilista = document.getElementById('agenda-estilista')?.value || 'Por asignar';
    const notas = document.getElementById('agenda-notas')?.value || '';

    if (!mascotaId) {
      this.notify('Selecciona primero una mascota para la cita.', 'warning');
      return;
    }
    if (!fecha || !hora) {
      this.notify('Selecciona una fecha y un horario disponible.', 'warning');
      return;
    }

    try {
      const fecha_hora = `${fecha}T${hora}:00`;
      await this.api.post('/citas', {
        mascota_id: mascotaId,
        fecha_hora,
        servicio,
        duracion_minutos: duracion,
        precio,
        estilista,
        notas_servicio: notas,
      });

      this.notify('Cita agendada exitosamente.', 'success');
      this.selectedSlot = null;
      const horaInput = document.getElementById('agenda-hora-seleccionada');
      if (horaInput) horaInput.value = '';
      await Promise.all([this.consultarDisponibilidad(), this.cargarCitas()]);
    } catch (err) {
      this.notify(`No se pudo agendar la cita: ${err.message}`, 'error');
    }
  }

  async cargarCitas() {
    const filtroFecha = document.getElementById('citas-filtro-fecha')?.value || '';
    const tbody = document.getElementById('agenda-citas-tbody');
    if (!tbody) return;

    try {
      const data = await this.api.get('/citas', { fecha: filtroFecha });
      const citas = data.citas || [];

      if (!citas.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-8 text-center text-slate-400 text-sm">
              No hay citas registradas para la fecha seleccionada.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = citas
        .map((c) => {
          const horaStr = c.fecha_hora
            ? new Date(c.fecha_hora).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-';
          const mascotaNombre = c.mascotas?.nombre || 'Mascota';
          const clienteNombre = c.mascotas?.clientes?.nombre || '';
          const completada = String(c.estado).toLowerCase() === 'completada';

          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-3 px-3 text-sm font-bold text-slate-800">${horaStr}</td>
              <td class="py-3 px-3 text-sm">
                <div class="font-semibold text-slate-800">${mascotaNombre}</div>
                <div class="text-xs text-slate-500">${clienteNombre}</div>
              </td>
              <td class="py-3 px-3 text-sm text-slate-700">
                <div>${c.servicio}</div>
                <div class="text-xs text-slate-400">${c.duracion_minutos} min</div>
              </td>
              <td class="py-3 px-3 text-xs text-slate-600">${c.estilista || 'Por asignar'}</td>
              <td class="py-3 px-3 text-sm font-semibold text-slate-800">$${Number(c.precio || 0).toFixed(2)}</td>
              <td class="py-3 px-3 text-right">
                ${
                  completada
                    ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        <i class="fa-solid fa-check mr-1"></i>Completada
                      </span>`
                    : `<button type="button"
                        data-cita-id="${c.id}"
                        data-cita-precio="${c.precio}"
                        class="btn-completar-cita px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition">
                        <i class="fa-solid fa-cash-register mr-1"></i>Cobrar y Completar
                      </button>`
                }
              </td>
            </tr>`;
        })
        .join('');

      tbody.querySelectorAll('.btn-completar-cita').forEach((btn) => {
        btn.addEventListener('click', () => {
          const citaId = btn.getAttribute('data-cita-id');
          const precio = btn.getAttribute('data-cita-precio');
          this.completarCita(citaId, precio);
        });
      });
    } catch (err) {
      this.notify(`Error al listar citas: ${err.message}`, 'error');
    }
  }

  async completarCita(citaId, precioSugerido) {
    const metodoPago =
      window.prompt(
        'Método de pago (Efectivo, Tarjeta, Transferencia):',
        'Efectivo'
      ) || 'Efectivo';

    try {
      await this.api.post(`/citas/${citaId}/completar`, {
        metodo_pago: metodoPago,
        monto: Number(precioSugerido || 0),
      });
      this.notify('Cita completada e ingreso registrado en caja.', 'success');
      await this.cargarCitas();
    } catch (err) {
      this.notify(`Error al completar cita: ${err.message}`, 'error');
    }
  }
}
