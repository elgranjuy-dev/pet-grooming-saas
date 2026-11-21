/**
 * AgendaView.js
 * Calendario Operativo (Vista Día Actual y Vista por Semanas)
 * con bloques disponibles interactivos, tarjetas de cita con nombre de mascota en grande,
 * dueño/teléfono/servicio en chico, botones de Asistió (Efectivo/Tarjeta) y No Asistió,
 * y barra financiera superior en tiempo real.
 */
export class AgendaView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.vistaModo = 'dia'; // 'dia' | 'semana'
    this.citasActuales = [];
    this.citaEligiendoPagoId = null;
  }

  _hoyLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  _sumarDiasISO(fechaStr, dias) {
    const partes = String(fechaStr || this._hoyLocalISO())
      .slice(0, 10)
      .split('-')
      .map(Number);
    const dt = new Date(partes[0], (partes[1] || 1) - 1, partes[2] || 1);
    dt.setDate(dt.getDate() + dias);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  _obtenerLunesYDomingoISO(fechaStr) {
    const partes = String(fechaStr || this._hoyLocalISO())
      .slice(0, 10)
      .split('-')
      .map(Number);
    const dt = new Date(partes[0], (partes[1] || 1) - 1, partes[2] || 1);
    const dayOfWeek = dt.getDay(); // 0 = Domingo, 1 = Lunes ...
    const diffLunes = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lunesDt = new Date(dt);
    lunesDt.setDate(dt.getDate() + diffLunes);
    const domingoDt = new Date(lunesDt);
    domingoDt.setDate(lunesDt.getDate() + 6);

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return {
      lunes: fmt(lunesDt),
      domingo: fmt(domingoDt),
    };
  }

  _extraerHoraHHMM(fechaHoraIso) {
    if (!fechaHoraIso) return '09:00';
    const str = String(fechaHoraIso);
    const match = str.match(/T(\d{2}:\d{2})/);
    if (match) return match[1];
    try {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    } catch (_) {}
    return '09:00';
  }

  _extraerFechaYYYYMMDD(fechaHoraIso) {
    if (!fechaHoraIso) return this._hoyLocalISO();
    return String(fechaHoraIso).slice(0, 10);
  }

  init() {
    const hoy = this._hoyLocalISO();
    const filtroFecha = document.getElementById('citas-filtro-fecha');
    if (filtroFecha && !filtroFecha.value) {
      filtroFecha.value = hoy;
    }

    // Botón superior para abrir el modal de agendar cita
    const btnAbrirModalCita = document.getElementById('btn-agenda-abrir-modal-cita');
    if (btnAbrirModalCita) {
      btnAbrirModalCita.addEventListener('click', () => {
        const fechaActiva = filtroFecha?.value || this._hoyLocalISO();
        this.abrirModalNuevaCitaEnBloque(fechaActiva, null);
      });
    }

    // Controles de navegación de fecha (Anterior, Hoy, Siguiente, Selector)
    const btnPrev = document.getElementById('btn-agenda-prev');
    const btnHoy = document.getElementById('btn-agenda-hoy');
    const btnNext = document.getElementById('btn-agenda-next');
    const btnFiltrar = document.getElementById('btn-filtrar-citas');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const actual = filtroFecha?.value || this._hoyLocalISO();
        const salto = this.vistaModo === 'semana' ? -7 : -1;
        if (filtroFecha) filtroFecha.value = this._sumarDiasISO(actual, salto);
        this.cargarCitas();
      });
    }

    if (btnHoy) {
      btnHoy.addEventListener('click', () => {
        if (filtroFecha) filtroFecha.value = this._hoyLocalISO();
        this.cargarCitas();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const actual = filtroFecha?.value || this._hoyLocalISO();
        const salto = this.vistaModo === 'semana' ? 7 : 1;
        if (filtroFecha) filtroFecha.value = this._sumarDiasISO(actual, salto);
        this.cargarCitas();
      });
    }

    if (filtroFecha) {
      filtroFecha.addEventListener('change', () => this.cargarCitas());
    }

    if (btnFiltrar) {
      btnFiltrar.addEventListener('click', () => this.cargarCitas());
    }

    // Switch entre Vista Día Actual y Vista por Semanas
    const btnVistaDia = document.getElementById('btn-agenda-vista-dia');
    const btnVistaSemana = document.getElementById('btn-agenda-vista-semana');
    const btnSwitchToggle = document.getElementById('btn-agenda-switch-toggle');

    if (btnVistaDia) {
      btnVistaDia.addEventListener('click', () => this.cambiarModoVista('dia'));
    }
    if (btnVistaSemana) {
      btnVistaSemana.addEventListener('click', () => this.cambiarModoVista('semana'));
    }
    if (btnSwitchToggle) {
      btnSwitchToggle.addEventListener('click', () => {
        this.cambiarModoVista(this.vistaModo === 'dia' ? 'semana' : 'dia');
      });
    }
  }

  cambiarModoVista(nuevoModo) {
    this.vistaModo = nuevoModo === 'semana' ? 'semana' : 'dia';

    const btnDia = document.getElementById('btn-agenda-vista-dia');
    const btnSem = document.getElementById('btn-agenda-vista-semana');
    const knob = document.getElementById('knob-agenda-switch-vista');

    if (this.vistaModo === 'dia') {
      if (btnDia) {
        btnDia.className =
          'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 bg-blue-600 text-white shadow-2xs';
      }
      if (btnSem) {
        btnSem.className =
          'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
      }
      if (knob) {
        knob.classList.remove('translate-x-4');
        knob.classList.add('translate-x-0');
      }
    } else {
      if (btnSem) {
        btnSem.className =
          'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 bg-blue-600 text-white shadow-2xs';
      }
      if (btnDia) {
        btnDia.className =
          'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
      }
      if (knob) {
        knob.classList.remove('translate-x-0');
        knob.classList.add('translate-x-4');
      }
    }

    this.cargarCitas();
  }

  async load() {
    await this.cargarCitas();
  }

  abrirModalNuevaCitaEnBloque(fecha, hora = null) {
    const hoy = this._hoyLocalISO();
    if (fecha && fecha < hoy) {
      this.notify('No se pueden agendar citas en fechas pasadas.', 'warning');
      return;
    }

    const clientesView = window.petGroomingApp?.views?.clientes;
    if (clientesView && typeof clientesView.abrirModalAgendarCitaMascota === 'function') {
      clientesView.abrirModalAgendarCitaMascota(null, {
        fecha: fecha || hoy,
        hora: hora || null,
      });
    }
  }

  _actualizarBarraFinanciera(resumen = {}, citas = []) {
    const kpiPorCobrar = document.getElementById('agenda-kpi-por-cobrar');
    const kpiPendienteSub = document.getElementById('agenda-kpi-pendiente-sub');
    const kpiCobradoReal = document.getElementById('agenda-kpi-cobrado-real');
    const kpiAsistenciaSub = document.getElementById('agenda-kpi-asistencia-sub');
    const kpiEfectivo = document.getElementById('agenda-kpi-efectivo');
    const kpiTarjeta = document.getElementById('agenda-kpi-tarjeta');
    const kpiTransferSub = document.getElementById('agenda-kpi-transferencia-sub');

    const porCobrar = Number(resumen.por_cobrar_total || 0);
    const pendiente = Number(resumen.pendiente_por_cobrar || 0);
    const cobradoReal = Number(resumen.cobrado_real || 0);
    const efectivo = Number(resumen.total_efectivo || 0);
    const tarjeta = Number(resumen.total_tarjeta || 0);
    const transferencia = Number(resumen.total_transferencia || 0);

    const numAsistieron = citas.filter((c) => c.asistencia === 'asistio').length;
    const numNoAsistieron = citas.filter((c) => c.asistencia === 'no_asistio').length;
    const numPendientes = citas.filter((c) => c.asistencia === 'pendiente').length;

    if (kpiPorCobrar) kpiPorCobrar.textContent = `$${porCobrar.toFixed(2)}`;
    if (kpiPendienteSub) {
      kpiPendienteSub.textContent = `Falta por cobrar: $${pendiente.toFixed(2)} (${numPendientes} pendiente${numPendientes === 1 ? '' : 's'})`;
    }
    if (kpiCobradoReal) kpiCobradoReal.textContent = `$${cobradoReal.toFixed(2)}`;
    if (kpiAsistenciaSub) {
      kpiAsistenciaSub.textContent = `${numAsistieron} asistieron · ${numNoAsistieron} no asistieron`;
    }
    if (kpiEfectivo) kpiEfectivo.textContent = `$${efectivo.toFixed(2)}`;
    if (kpiTarjeta) kpiTarjeta.textContent = `$${tarjeta.toFixed(2)}`;
    if (kpiTransferSub) {
      kpiTransferSub.textContent =
        transferencia > 0
          ? `+ $${transferencia.toFixed(2)} en Transferencia`
          : 'Terminal / Voucher electrónico';
    }
  }

  async cargarCitas() {
    const filtroFechaEl = document.getElementById('citas-filtro-fecha');
    const fechaSeleccionada = filtroFechaEl?.value || this._hoyLocalISO();
    if (filtroFechaEl && !filtroFechaEl.value) {
      filtroFechaEl.value = fechaSeleccionada;
    }

    const container = document.getElementById('agenda-calendar-container');
    const rangoLabel = document.getElementById('agenda-rango-label');
    if (!container) return;

    try {
      container.innerHTML = `
        <div class="p-12 text-center text-slate-400 text-xs font-semibold">
          <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-lg mb-2 block"></i>
          Cargando calendario y disponibilidad...
        </div>`;

      if (this.vistaModo === 'semana') {
        const { lunes, domingo } = this._obtenerLunesYDomingoISO(fechaSeleccionada);
        if (rangoLabel) {
          rangoLabel.textContent = `Semana: ${lunes} al ${domingo}`;
        }

        const [dispSemana, citasData] = await Promise.all([
          this.api.get('/disponibilidad/semana', {
            fecha: fechaSeleccionada,
            duracion_minutos: 60,
          }),
          this.api.get('/citas', {
            fecha_inicio: lunes,
            fecha_fin: domingo,
          }),
        ]);

        this.citasActuales = citasData.citas || [];
        this._actualizarBarraFinanciera(citasData.resumen_financiero, this.citasActuales);
        this._renderVistaSemana(dispSemana, this.citasActuales, container);
      } else {
        const hoy = this._hoyLocalISO();
        if (rangoLabel) {
          rangoLabel.textContent =
            fechaSeleccionada === hoy ? `Hoy (${fechaSeleccionada})` : `Día: ${fechaSeleccionada}`;
        }

        const [dispDia, citasData] = await Promise.all([
          this.api.get('/disponibilidad', {
            fecha: fechaSeleccionada,
            duracion_minutos: 60,
          }),
          this.api.get('/citas', {
            fecha: fechaSeleccionada,
          }),
        ]);

        this.citasActuales = citasData.citas || [];
        this._actualizarBarraFinanciera(citasData.resumen_financiero, this.citasActuales);
        this._renderVistaDia(dispDia, this.citasActuales, container);
      }
    } catch (err) {
      container.innerHTML = `
        <div class="p-8 text-center text-rose-600 text-xs font-bold">
          Error al cargar el calendario de agenda: ${err.message}
        </div>`;
    }
  }

  _construirTarjetaCitaHtml(c, modoCompacto = false) {
    const horaStr = this._extraerHoraHHMM(c.fecha_hora);
    const mascotaNombre = c.mascota_nombre || c.mascotas?.nombre || 'Mascota';
    const mascotaRaza = c.mascota_raza || c.mascotas?.raza || '';
    const clienteNombre = c.cliente_nombre || c.mascotas?.clientes?.nombre || 'Sin dueño';
    const clienteTel =
      c.cliente_telefono || c.cliente_telefono_enmascarado || c.mascotas?.clientes?.telefono || 'Sin tel.';
    const servicio = c.servicio || 'Servicio Grooming';
    const estilista = c.estilista || 'Por asignar';
    const precio = Number(c.precio || 0).toFixed(2);
    const asistencia = c.asistencia || 'pendiente';
    const etapaEstancia = c.etapa_estancia || (asistencia === 'asistio' ? 'Entregada' : 'Por llegar');
    const metodoPago = c.metodo_pago || 'Efectivo';
    const eligiendoPago = this.citaEligiendoPagoId === c.id;

    let cardStyle = 'bg-blue-50/85 border-l-4 border-l-blue-600 border-slate-200';
    let badgeEstado = `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">Programada</span>`;

    if (asistencia === 'asistio') {
      cardStyle = 'bg-emerald-50/90 border-l-4 border-l-emerald-600 border-emerald-200';
      const iconMetodo =
        String(metodoPago).toLowerCase().includes('tarjeta')
          ? '<i class="fa-solid fa-credit-card mr-1"></i>'
          : '<i class="fa-solid fa-money-bill-wave mr-1"></i>';
      badgeEstado = `
        <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold inline-flex items-center">
          <i class="fa-solid fa-check mr-1"></i>Asistió · ${iconMetodo}${metodoPago}
        </span>`;
    } else if (asistencia === 'no_asistio') {
      cardStyle = 'bg-rose-50/80 border-l-4 border-l-rose-500 border-rose-200 opacity-80';
      badgeEstado = `
        <span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold inline-flex items-center">
          <i class="fa-solid fa-user-xmark mr-1"></i>No Asistió
        </span>`;
    } else if (asistencia === 'cancelada') {
      cardStyle = 'bg-slate-100 border-l-4 border-l-slate-400 border-slate-300 opacity-75';
      badgeEstado = `
        <span class="px-2 py-0.5 rounded-full bg-slate-600 text-white text-[10px] font-extrabold inline-flex items-center">
          <i class="fa-solid fa-ban mr-1"></i>Cancelada con aviso
        </span>`;
    }

    // Selector rápido de Etapa de Estancia en Cabina (Recibida -> En servicio -> Lista -> Entregada)
    const etapasOpciones = [
      { val: 'Por llegar', label: '⏳ Por llegar' },
      { val: 'Recibida', label: '🐾 Recibida' },
      { val: 'En servicio', label: '🛁 En servicio' },
      { val: 'Lista para recoger', label: '✨ Lista para recoger' },
      { val: 'Entregada', label: '✅ Entregada' },
    ];
    const selectorEstanciaHtml =
      asistencia === 'no_asistio' || asistencia === 'cancelada'
        ? ''
        : `
          <select data-select-estancia="${c.id}" title="Seguimiento de la mascota durante su estancia en cabina"
            class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            ${etapasOpciones
              .map(
                (op) =>
                  `<option value="${op.val}" ${
                    etapaEstancia === op.val ? 'selected' : ''
                  }>${op.label}</option>`
              )
              .join('')}
          </select>
        `;

    // Controles de Asistió / No Asistió / Cancelar
    const botonesAsistenciaHtml = eligiendoPago
      ? `
        <div class="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-emerald-300 shadow-xs">
          <span class="text-[10px] font-extrabold text-slate-700 px-1">¿Cómo pagó?:</span>
          <button type="button"
            data-action-asistio-pago="${c.id}"
            data-metodo-pago="Efectivo"
            data-cita-precio="${c.precio || 0}"
            class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer">
            <i class="fa-solid fa-money-bill-wave"></i>
            <span>Efectivo</span>
          </button>
          <button type="button"
            data-action-asistio-pago="${c.id}"
            data-metodo-pago="Tarjeta"
            data-cita-precio="${c.precio || 0}"
            class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer">
            <i class="fa-solid fa-credit-card"></i>
            <span>Tarjeta</span>
          </button>
          <button type="button"
            data-action-asistio-pago="${c.id}"
            data-metodo-pago="Transferencia"
            data-cita-precio="${c.precio || 0}"
            class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer">
            <i class="fa-solid fa-building-columns"></i>
            <span>Transf.</span>
          </button>
          <button type="button"
            data-action-cancel-pago="${c.id}"
            class="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold">
            ✕
          </button>
        </div>
      `
      : `
        <div class="flex flex-wrap items-center gap-1.5">
          ${selectorEstanciaHtml}
          <button type="button"
            data-action-abrir-asistio="${c.id}"
            title="${asistencia === 'asistio' ? 'Cambiar método de pago registrado' : 'Marcar asistencia y registrar cobro'}"
            class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
              asistencia === 'asistio'
                ? 'bg-emerald-700 text-white shadow-2xs ring-2 ring-emerald-300'
                : 'bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300'
            }">
            <i class="fa-solid fa-circle-check"></i>
            <span>${asistencia === 'asistio' ? 'Cobrada (Editar)' : 'Asistió'}</span>
          </button>

          <button type="button"
            data-action-no-asistio="${c.id}"
            title="El cliente no se presentó a su cita"
            class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
              asistencia === 'no_asistio'
                ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-300'
                : 'bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300'
            }">
            <i class="fa-solid fa-circle-xmark"></i>
            <span>No Asistió</span>
          </button>

          ${
            asistencia !== 'cancelada'
              ? `<button type="button"
                  data-action-cancelar-cita="${c.id}"
                  title="Cancelar cita anticipadamente (libera el cupo sin marcar inasistencia)"
                  class="px-2 py-1.5 rounded-xl text-[10px] font-bold bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 transition cursor-pointer">
                  <i class="fa-solid fa-ban mr-0.5"></i>Cancelar
                </button>`
              : ''
          }
        </div>
      `;

    if (modoCompacto) {
      // Tarjeta optimizada para celda del calendario semanal
      return `
        <div class="rounded-xl border p-2.5 shadow-2xs transition ${cardStyle} space-y-1.5">
          <div class="flex items-start justify-between gap-1">
            <!-- EN GRANDE: Nombre de la Mascota -->
            <div class="text-sm sm:text-base font-black text-slate-900 leading-tight tracking-tight break-words">
              🐾 ${mascotaNombre}
            </div>
            <span class="font-extrabold text-xs text-emerald-700 shrink-0">$${precio}</span>
          </div>

          <!-- EN CHICO: Nombre del Dueño, su Teléfono y el Servicio -->
          <div class="text-[10px] text-slate-600 leading-snug space-y-0.5">
            <div class="font-semibold text-slate-700 truncate" title="${clienteNombre} · ${clienteTel}">
              <i class="fa-solid fa-user text-[9px] text-slate-400 mr-1"></i>${clienteNombre} · <span class="font-mono font-bold">${clienteTel}</span>
            </div>
            <div class="text-blue-700 font-bold truncate" title="${servicio} (${estilista})">
              <i class="fa-solid fa-scissors text-[9px] mr-1"></i>${servicio} <span class="text-slate-400 font-normal">(${horaStr})</span>
            </div>
          </div>

          <div class="pt-1 border-t border-slate-200/60 flex flex-col gap-1">
            <div>${badgeEstado}</div>
            ${botonesAsistenciaHtml}
          </div>
        </div>
      `;
    }

    // Tarjeta amplia para la Vista Día Actual en pantalla completa
    return `
      <div class="rounded-2xl border p-3.5 shadow-2xs transition ${cardStyle} flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-extrabold">
              ${horaStr} hrs
            </span>
            <!-- EN GRANDE: Nombre de la Mascota -->
            <h4 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
              <i class="fa-solid fa-paw text-blue-600 text-sm"></i>
              <span>${mascotaNombre}</span>
            </h4>
            ${
              mascotaRaza
                ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-600">${mascotaRaza}</span>`
                : ''
            }
            ${badgeEstado}
          </div>

          <!-- EN CHICO: Nombre del dueño, su teléfono y el servicio -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
            <span>
              <i class="fa-solid fa-user text-slate-400 mr-1"></i>Dueño: <strong class="text-slate-800">${clienteNombre}</strong>
            </span>
            <span>
              <i class="fa-solid fa-phone text-emerald-600 mr-1"></i>Tel: <strong class="font-mono text-slate-800">${clienteTel}</strong>
            </span>
            <span>
              <i class="fa-solid fa-scissors text-blue-600 mr-1"></i>Servicio: <strong class="text-blue-800">${servicio}</strong>
              <span class="text-slate-400">(${c.duracion_minutos || 60} min · Estilista: ${estilista})</span>
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
          <div class="text-left lg:text-right pr-1">
            <span class="text-[10px] uppercase font-extrabold text-slate-400 block">Importe Cita</span>
            <span class="text-base font-black ${
              asistencia === 'no_asistio' || asistencia === 'cancelada'
                ? 'line-through text-slate-400'
                : 'text-slate-900'
            }">$${precio}</span>
          </div>
          ${botonesAsistenciaHtml}
        </div>
      </div>
    `;
  }

  _renderVistaDia(dispDia, citasDia, container) {
    const fecha = dispDia.fecha || this._hoyLocalISO();
    const nombreDia = dispDia.nombre_dia || 'Día';
    const slots = dispDia.slots || [];

    // Agrupar citas por hora (HH:00 o HH:MM exacto)
    const citasPorHora = {};
    citasDia.forEach((c) => {
      const h = this._extraerHoraHHMM(c.fecha_hora);
      const bucket = `${h.slice(0, 2)}:00`;
      if (!citasPorHora[bucket]) citasPorHora[bucket] = [];
      citasPorHora[bucket].push(c);
    });

    // Construir lista ordenada de horas combinando slots de disponibilidad y citas existentes
    const horasMap = new Map();
    slots.forEach((s) => {
      horasMap.set(s.hora, s);
    });
    Object.keys(citasPorHora).forEach((h) => {
      if (!horasMap.has(h)) {
        horasMap.set(h, {
          hora: h,
          hora_fin: '',
          disponible: false,
          pasado: fecha < this._hoyLocalISO(),
          cupos_disponibles: 0,
          capacidad_total: 0,
        });
      }
    });

    const horasOrdenadas = Array.from(horasMap.keys()).sort();

    if (!horasOrdenadas.length) {
      container.innerHTML = `
        <div class="p-8 text-center space-y-2">
          <p class="text-sm font-extrabold text-slate-700">
            ${dispDia.abierto === false ? `Sucursal cerrada: ${dispDia.motivo_cierre || 'Día inhábil'}` : 'Sin bloques horarios para este día'}
          </p>
          <p class="text-xs text-slate-500">Cambia la fecha o usa el switch "Por Semanas" para explorar otros días.</p>
        </div>`;
      return;
    }

    const filasHtml = horasOrdenadas
      .map((hora) => {
        const slot = horasMap.get(hora) || {};
        const citasEnBloque = citasPorHora[hora] || [];
        const disponible = Boolean(slot.disponible) && !slot.pasado;
        const cupos = Number(slot.cupos_disponibles || 0);

        const tarjetasCitasHtml = citasEnBloque
          .map((c) => this._construirTarjetaCitaHtml(c, false))
          .join('');

        let bloqueDisponibleHtml = '';
        if (disponible) {
          bloqueDisponibleHtml = `
            <button type="button"
              data-agendar-slot-fecha="${fecha}"
              data-agendar-slot-hora="${hora}"
              class="w-full rounded-xl border border-dashed border-teal-400 bg-teal-50/50 hover:bg-teal-100/70 hover:border-teal-600 px-3.5 py-2.5 text-left flex flex-wrap items-center justify-between gap-2 transition group cursor-pointer">
              <span class="text-xs font-extrabold text-teal-900 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-teal-600 text-white inline-flex items-center justify-center text-[11px] group-hover:scale-105 transition">
                  <i class="fa-solid fa-plus"></i>
                </span>
                <span>Bloque Disponible a las ${hora} hrs (${cupos} cupo${cupos === 1 ? '' : 's'} libre${cupos === 1 ? '' : 's'})</span>
              </span>
              <span class="text-[11px] font-bold text-teal-700 group-hover:underline">
                Clic para agendar cita aquí →
              </span>
            </button>
          `;
        } else if (!citasEnBloque.length) {
          if (slot.pasado) {
            bloqueDisponibleHtml = `
              <div class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-400 flex items-center justify-between">
                <span><i class="fa-solid fa-lock mr-1.5"></i>Horario pasado (Sin citas registradas)</span>
                <span>Bloqueado</span>
              </div>`;
          } else if (slot.en_horario_comida) {
            bloqueDisponibleHtml = `
              <div class="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                <span><i class="fa-solid fa-utensils mr-1.5"></i>Horario de comida del personal</span>
                <span>Sin cupo libre</span>
              </div>`;
          } else {
            bloqueDisponibleHtml = `
              <div class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-400">
                Sin cupos disponibles en este bloque
              </div>`;
          }
        }

        return `
          <div class="flex flex-col sm:flex-row items-stretch border-b border-slate-200 last:border-b-0 hover:bg-slate-50/40 transition">
            <!-- Columna de Hora -->
            <div class="sm:w-28 shrink-0 px-3.5 py-3 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1">
              <div>
                <span class="font-mono text-sm font-black text-slate-900 block">${hora}</span>
                ${
                  slot.hora_fin
                    ? `<span class="font-mono text-[10px] text-slate-400">a ${slot.hora_fin}</span>`
                    : ''
                }
              </div>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                citasEnBloque.length > 0
                  ? 'bg-blue-100 text-blue-800'
                  : disponible
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-slate-200 text-slate-600'
              }">
                ${citasEnBloque.length} cita${citasEnBloque.length === 1 ? '' : 's'}
              </span>
            </div>

            <!-- Contenido del Bloque: Citas del Día + Bloque Disponible -->
            <div class="flex-1 p-3 space-y-2.5">
              ${tarjetasCitasHtml}
              ${bloqueDisponibleHtml}
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="font-extrabold flex items-center gap-2">
          <i class="fa-solid fa-calendar-day text-blue-400"></i>
          <span>${nombreDia} ${fecha} — Agenda Completa del Día</span>
        </div>
        <div class="text-[11px] text-slate-300 font-semibold">
          Total citas del día: <strong class="text-white">${citasDia.length}</strong> · Bloques con cupo: <strong class="text-teal-300">${(dispDia.horarios_disponibles || []).length}</strong>
        </div>
      </div>
      <div class="divide-y divide-slate-200">
        ${filasHtml}
      </div>
    `;

    this._bindAccionesCalendario(container);
  }

  _renderVistaSemana(dispSemana, citasSemana, container) {
    const dias = dispSemana.dias || [];
    const hoy = this._hoyLocalISO();
    const fechaActiva =
      document.getElementById('citas-filtro-fecha')?.value || hoy;

    // Indexar citas por (fecha, horaBucket)
    const citasGrid = {};
    const horasSet = new Set(dispSemana.horas_eje || []);

    citasSemana.forEach((c) => {
      const f = this._extraerFechaYYYYMMDD(c.fecha_hora);
      const h = `${this._extraerHoraHHMM(c.fecha_hora).slice(0, 2)}:00`;
      horasSet.add(h);
      const key = `${f}_${h}`;
      if (!citasGrid[key]) citasGrid[key] = [];
      citasGrid[key].push(c);
    });

    const horasEje = Array.from(horasSet).sort();
    if (!horasEje.length) {
      for (let h = 9; h <= 17; h += 1) {
        horasEje.push(`${String(h).padStart(2, '0')}:00`);
      }
    }

    const headersHtml = dias
      .map((d) => {
        const esHoy = d.fecha === hoy;
        const esSeleccionado = d.fecha === fechaActiva;
        const citasDelDia = citasSemana.filter(
          (c) => this._extraerFechaYYYYMMDD(c.fecha_hora) === d.fecha
        );
        const cobradoDia = citasDelDia
          .filter((c) => c.asistencia === 'asistio')
          .reduce((acc, c) => acc + Number(c.precio || 0), 0);

        return `
          <th class="p-2.5 border-l border-slate-200 min-w-[185px] align-top ${
            esHoy
              ? 'bg-blue-600 text-white'
              : esSeleccionado
              ? 'bg-blue-50 text-blue-900'
              : 'bg-slate-50 text-slate-800'
          }">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] uppercase font-extrabold tracking-wider ${
                esHoy ? 'text-blue-100' : 'text-slate-500'
              }">${d.nombre_dia || ''}</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                esHoy ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
              }">${citasDelDia.length} cita${citasDelDia.length === 1 ? '' : 's'}</span>
            </div>
            <div class="flex items-baseline justify-between mt-1">
              <button type="button"
                data-ir-vista-dia="${d.fecha}"
                title="Ver este día en detalle"
                class="text-sm font-black hover:underline cursor-pointer">
                ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}
              </button>
              <span class="text-[10px] font-extrabold ${
                esHoy ? 'text-emerald-200' : 'text-emerald-700'
              }">Cobrado: $${cobradoDia.toFixed(0)}</span>
            </div>
          </th>
        `;
      })
      .join('');

    const filasHtml = horasEje
      .map((hora) => {
        const celdasHtml = dias
          .map((d) => {
            const key = `${d.fecha}_${hora}`;
            const citasCelda = citasGrid[key] || [];
            const slot = (d.slots || []).find((s) => s.hora === hora);
            const disponible = Boolean(slot?.disponible) && !slot?.pasado;
            const cupos = Number(slot?.cupos_disponibles || 0);

            const citasHtml = citasCelda
              .map((c) => this._construirTarjetaCitaHtml(c, true))
              .join('');

            let botonDisponibleHtml = '';
            if (disponible) {
              botonDisponibleHtml = `
                <button type="button"
                  data-agendar-slot-fecha="${d.fecha}"
                  data-agendar-slot-hora="${hora}"
                  class="w-full rounded-xl border border-dashed border-teal-400 bg-teal-50/60 hover:bg-teal-100/80 px-2 py-1.5 text-center transition cursor-pointer">
                  <span class="text-[11px] font-extrabold text-teal-800 block">
                    <i class="fa-solid fa-plus mr-0.5"></i>Disponible (${cupos})
                  </span>
                </button>
              `;
            } else if (!citasCelda.length) {
              if (!d.abierto) {
                botonDisponibleHtml = `<div class="text-[10px] text-slate-300 text-center py-2">Cerrado</div>`;
              } else if (slot?.pasado) {
                botonDisponibleHtml = `<div class="text-[10px] text-slate-300 text-center py-2"><i class="fa-solid fa-lock mr-0.5"></i>Pasado</div>`;
              } else {
                botonDisponibleHtml = `<div class="text-[10px] text-rose-300 text-center py-2">Sin cupo</div>`;
              }
            }

            return `
              <td class="p-2 border-l border-t border-slate-200 align-top space-y-2 ${
                d.fecha === hoy ? 'bg-blue-50/20' : 'bg-white'
              }">
                ${citasHtml}
                ${botonDisponibleHtml}
              </td>
            `;
          })
          .join('');

        return `
          <tr>
            <td class="p-2.5 border-t border-slate-200 bg-slate-50 font-mono font-black text-xs text-slate-800 text-center align-top whitespace-nowrap">
              ${hora}
            </td>
            ${celdasHtml}
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="font-extrabold flex items-center gap-2">
          <i class="fa-solid fa-table-columns text-blue-400"></i>
          <span>Calendario Semanal (${dispSemana.fecha_inicio_semana} al ${dispSemana.fecha_fin_semana})</span>
        </div>
        <div class="text-[11px] text-slate-300">
          Haz clic en cualquier bloque <strong class="text-teal-300">+ Disponible</strong> para agendar o marca <strong class="text-emerald-300">Asistió / No Asistió</strong>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="p-2.5 bg-slate-100 text-slate-600 font-extrabold text-[10px] uppercase w-20">Hora</th>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </div>
    `;

    this._bindAccionesCalendario(container);
  }

  _bindAccionesCalendario(container) {
    // 1. Clic en un bloque disponible para agregar cita en esa fecha y hora
    container.querySelectorAll('[data-agendar-slot-fecha]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-agendar-slot-fecha');
        const h = btn.getAttribute('data-agendar-slot-hora');
        this.abrirModalNuevaCitaEnBloque(f, h);
      });
    });

    // 2. Clic en el encabezado de fecha en vista semana para ir al detalle de ese día
    container.querySelectorAll('[data-ir-vista-dia]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-ir-vista-dia');
        const filtroFecha = document.getElementById('citas-filtro-fecha');
        if (f && filtroFecha) {
          filtroFecha.value = f;
        }
        this.cambiarModoVista('dia');
      });
    });

    // 3. Clic en "Asistió" -> Mostrar opciones rápidas Efectivo / Tarjeta
    container.querySelectorAll('[data-action-abrir-asistio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-action-abrir-asistio');
        this.citaEligiendoPagoId = cid;
        this.cargarCitas();
      });
    });

    // 4. Cancelar selección de pago
    container.querySelectorAll('[data-action-cancel-pago]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.citaEligiendoPagoId = null;
        this.cargarCitas();
      });
    });

    // 5. Confirmar "Asistió" con Efectivo o Tarjeta
    container.querySelectorAll('[data-action-asistio-pago]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-action-asistio-pago');
        const metodo = btn.getAttribute('data-metodo-pago') || 'Efectivo';
        const precio = Number(btn.getAttribute('data-cita-precio') || 0);
        await this.marcarAsistioCita(cid, metodo, precio);
      });
    });

    // 6. Marcar "No Asistió"
    container.querySelectorAll('[data-action-no-asistio]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-action-no-asistio');
        await this.marcarNoAsistioCita(cid);
      });
    });

    // 7. Cambio de etapa de estancia en cabina (Por llegar -> Recibida -> En servicio -> Lista -> Entregada)
    container.querySelectorAll('[data-select-estancia]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const cid = sel.getAttribute('data-select-estancia');
        const etapa = sel.value || 'Por llegar';
        await this.cambiarEtapaEstanciaCita(cid, etapa);
      });
    });

    // 8. Cancelar cita anticipadamente (distinto de No Asistió)
    container.querySelectorAll('[data-action-cancelar-cita]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-action-cancelar-cita');
        await this.cancelarCitaConAviso(cid);
      });
    });
  }

  async _sincronizarVistasDependientes() {
    await this.cargarCitas();
    const views = window.petGroomingApp?.views || {};
    if (views.caja && typeof views.caja.load === 'function') {
      await views.caja.load();
    }
    if (views.dashboard && typeof views.dashboard.load === 'function') {
      await views.dashboard.load();
    }
    if (views.clientes && typeof views.clientes.cargarPadronGeneral === 'function') {
      await views.clientes.cargarPadronGeneral();
    }
  }

  async cambiarEtapaEstanciaCita(citaId, etapaEstancia) {
    if (!citaId) return;
    try {
      await this.api.put(`/citas/${citaId}`, {
        etapa_estancia: etapaEstancia,
      });
      this.notify(`Estancia en cabina actualizada: ${etapaEstancia}`, 'info');
      await this.cargarCitas();
    } catch (err) {
      this.notify(`Error al actualizar estancia: ${err.message}`, 'error');
    }
  }

  async cancelarCitaConAviso(citaId) {
    if (!citaId) return;
    const confirmar = window.confirm(
      '¿Cancelar esta cita con aviso anticipado?\nSe liberará el espacio del horario y no se marcará como inasistencia (No Asistió).'
    );
    if (!confirmar) return;

    try {
      this.citaEligiendoPagoId = null;
      await this.api.put(`/citas/${citaId}`, {
        estado: 'Cancelada',
        etapa_estancia: 'Cancelada',
      });
      this.notify('Cita cancelada con aviso. Se liberó el bloque horario.', 'info');
      await this._sincronizarVistasDependientes();
    } catch (err) {
      this.notify(`Error al cancelar cita: ${err.message}`, 'error');
    }
  }

  async marcarAsistioCita(citaId, metodoPago, monto) {
    if (!citaId) return;
    try {
      this.citaEligiendoPagoId = null;
      await this.api.post(`/citas/${citaId}/completar`, {
        metodo_pago: metodoPago,
        monto: Number(monto || 0),
      });
      this.notify(
        `Cita marcada como Asistió ($${Number(monto || 0).toFixed(2)} en ${metodoPago}). Balance y lealtad actualizados.`,
        'success'
      );
      await this._sincronizarVistasDependientes();
    } catch (err) {
      this.notify(`Error al registrar asistencia: ${err.message}`, 'error');
    }
  }

  async marcarNoAsistioCita(citaId) {
    if (!citaId) return;
    try {
      this.citaEligiendoPagoId = null;
      await this.api.post(`/citas/${citaId}/no-asistio`, {});
      this.notify(
        'Cita marcada como No Asistió. Se actualizó la disponibilidad, lealtad y corte del día.',
        'info'
      );
      await this._sincronizarVistasDependientes();
    } catch (err) {
      this.notify(`Error al marcar No Asistió: ${err.message}`, 'error');
    }
  }
}

