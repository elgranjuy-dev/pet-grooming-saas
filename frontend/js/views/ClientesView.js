/**
 * ClientesView.js
 * Vista POO para:
 * 1. Barra de búsqueda fija en la parte superior del menú lateral izquierdo:
 *    - Al dar clic en Buscar, limpia inmediatamente la caja de búsqueda para dejarla lista.
 *    - Abre un Pop-up con las coincidencias encontradas (mostrando solo los últimos 4 dígitos del celular)
 *      o una ventana indicando "No hay coincidencias".
 * 2. Botón "Registrar Nuevo Cliente" debajo de la barra de búsqueda en el menú izquierdo:
 *    - Abre un Pop-up con el formulario de alta de cliente.
 * 3. Al acceder al perfil de un cliente desde los resultados de búsqueda:
 *    - NO envía ni cambia a otra sección; abre un Pop-up Grande (#modal-expediente-cliente)
 *      con el perfil del cliente, actividad en la estética y sus mascotas.
 * 4. Dentro de cada caja de mascota incluye un botón "+ Agregar Cita" que abre el Pop-up
 *    de agendamiento directo para esa mascota.
 */
export class ClientesView {
  static RAZAS_SUGERIDAS = [
    'Mestiza',
    'Schnauzer',
    'Poodle / Caniche',
    'French Poodle',
    'Maltés',
    'Yorkshire Terrier',
    'Shih Tzu',
    'Pomerania',
    'Chihuahua',
    'Pug',
    'Bulldog Francés',
    'Bulldog Inglés',
    'Golden Retriever',
    'Labrador Retriever',
    'Husky Siberiano',
    'Pastor Alemán',
    'Cocker Spaniel',
    'Beagle',
    'Bichón Frisé',
    'West Highland Terrier (Westie)',
    'Dachshund (Salchicha)',
    'Border Collie',
    'Boxer',
    'Pastor Belga Malinois',
    'Jack Russell Terrier',
    'San Bernardo',
    'Samoyedo',
    'Chow Chow',
    'Akita',
    'Shiba Inu',
    'Pitbull',
    'Rottweiler',
    'Doberman',
    'Shar Pei',
    'Basset Hound',
    'Gran Danés',
    'Gato Mestizo (Doméstico)',
    'Gato Persa',
    'Gato Siamés',
    'Gato Maine Coon',
    'Gato Angora',
  ];

  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.clientesEncontrados = [];
    this.expedienteActual = null;
    this.mascotaSeleccionadaId = null;
    this.serviciosCatalogo = [];
    this.estilistasSucursal = [];
    this.slotSeleccionadoModalCita = null;
  }

  init() {
    // 1. Buscador en menú lateral izquierdo
    const formBuscar = document.getElementById('form-buscar-clientes');
    if (formBuscar) {
      formBuscar.addEventListener('submit', (e) => {
        e.preventDefault();
        this.buscarClientesEnPopup();
      });
    }

    // Cerrar pop-up de coincidencias de búsqueda
    const modalBusqueda = document.getElementById('modal-busqueda-clientes');
    const btnCerrarModalBusqueda = document.getElementById('btn-cerrar-modal-busqueda-clientes');
    if (btnCerrarModalBusqueda && modalBusqueda) {
      btnCerrarModalBusqueda.addEventListener('click', () => {
        modalBusqueda.classList.add('hidden');
      });
      modalBusqueda.addEventListener('click', (e) => {
        if (e.target === modalBusqueda) {
          modalBusqueda.classList.add('hidden');
        }
      });
    }

    // 2. Pop-up Registrar Nuevo Cliente (botón debajo del buscador en menú izquierdo)
    const btnOpenNuevoCliente = document.getElementById('btn-open-modal-nuevo-cliente');
    const modalNuevoCliente = document.getElementById('modal-nuevo-cliente');
    const btnCerrarNuevoCliente = document.getElementById('btn-cerrar-modal-nuevo-cliente');
    const btnCancelarNuevoCliente = document.getElementById('btn-cancelar-modal-nuevo-cliente');

    if (btnOpenNuevoCliente && modalNuevoCliente) {
      btnOpenNuevoCliente.addEventListener('click', () => {
        modalNuevoCliente.classList.remove('hidden');
        setTimeout(() => {
          document.getElementById('cliente-nombre')?.focus();
        }, 50);
      });
    }
    const cerrarModalNuevo = () => modalNuevoCliente?.classList.add('hidden');
    if (btnCerrarNuevoCliente) btnCerrarNuevoCliente.addEventListener('click', cerrarModalNuevo);
    if (btnCancelarNuevoCliente) btnCancelarNuevoCliente.addEventListener('click', cerrarModalNuevo);
    if (modalNuevoCliente) {
      modalNuevoCliente.addEventListener('click', (e) => {
        if (e.target === modalNuevoCliente) cerrarModalNuevo();
      });
    }

    const formCliente = document.getElementById('form-crear-cliente');
    if (formCliente) {
      formCliente.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearCliente();
      });
    }

    // 3. Pop-up Grande de Perfil / Expediente del Cliente
    const modalExpediente = document.getElementById('modal-expediente-cliente');
    const btnCerrarExpedienteModal = document.getElementById('btn-cerrar-modal-expediente-cliente');
    if (btnCerrarExpedienteModal && modalExpediente) {
      btnCerrarExpedienteModal.addEventListener('click', () => {
        modalExpediente.classList.add('hidden');
      });
      modalExpediente.addEventListener('click', (e) => {
        if (e.target === modalExpediente) {
          modalExpediente.classList.add('hidden');
        }
      });
    }

    // 4. Pop-up de Agregar Cita para Mascota
    this.initModalAgendarCitaEvents();
  }

  async load() {
    // Nunca se precarga información de clientes sin búsqueda previa
  }

  enmascararUltimos4(telefonoStr, ultimos4 = '') {
    if (ultimos4 && String(ultimos4).length >= 4) {
      return `•••• ••${String(ultimos4).slice(-4)}`;
    }
    const digitos = String(telefonoStr || '').replace(/\D/g, '');
    if (digitos.length >= 4) {
      return `•••• ••${digitos.slice(-4)}`;
    }
    return String(telefonoStr || '••••');
  }

  cerrarPopupBusqueda() {
    document.getElementById('modal-busqueda-clientes')?.classList.add('hidden');
  }

  cerrarPopupExpediente() {
    document.getElementById('modal-expediente-cliente')?.classList.add('hidden');
  }

  renderResultadosEnModulo(clientes) {
    const expView = document.getElementById('cliente-expediente-view');
    if (!expView) return;

    if (!clientes || !clientes.length) {
      expView.innerHTML = `
        <div class="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
          <i class="fa-solid fa-magnifying-glass text-slate-400 text-base mb-1.5 block"></i>
          No hay coincidencias.
        </div>
      `;
      return;
    }

    expView.innerHTML = `
      <div class="space-y-2">
        ${this.construirTarjetasCoincidenciasHtml(clientes)}
      </div>
    `;

    expView.querySelectorAll('.card-coincidencia-cliente').forEach((card) => {
      card.addEventListener('click', () => {
        const cid = card.getAttribute('data-open-cliente-id');
        if (cid) {
          this.abrirExpedienteCliente(cid);
        }
      });
    });
  }

  construirTarjetasCoincidenciasHtml(clientes) {
    return clientes
      .map((c) => {
        const telMask = this.enmascararUltimos4(c.telefono, c.ultimos_4_telefono);
        const mascotas = c.mascotas || [];
        const chipsMascotas = mascotas.length
          ? mascotas
              .map(
                (m) =>
                  `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[10px] font-bold">
                    <i class="fa-solid fa-paw text-[9px]"></i>${m.nombre} (${m.raza})
                  </span>`
              )
              .join('')
          : `<span class="text-[11px] text-slate-400 italic">Sin mascotas registradas</span>`;

        return `
          <div data-open-cliente-id="${c.id}"
            class="card-coincidencia-cliente cursor-pointer rounded-xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 p-3.5 shadow-2xs transition flex items-center justify-between gap-3 group">
            <div class="space-y-1.5 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="w-7 h-7 rounded-lg bg-slate-900 group-hover:bg-blue-600 text-white text-xs font-extrabold inline-flex items-center justify-center transition">
                  ${(c.nombre || 'C').charAt(0).toUpperCase()}
                </span>
                <h4 class="font-extrabold text-slate-900 group-hover:text-blue-700 text-sm transition">${c.nombre}</h4>
                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  <i class="fa-solid fa-mobile-screen mr-1 text-slate-400"></i>${telMask}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 pl-9">
                ${chipsMascotas}
              </div>
            </div>
            <div class="shrink-0">
              <span class="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white text-xs font-bold transition inline-flex items-center gap-1.5">
                <span>Abrir Perfil</span>
                <i class="fa-solid fa-arrow-right text-[10px]"></i>
              </span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  mostrarVentanaSinCoincidencias() {
    const modal = document.getElementById('modal-busqueda-clientes');
    const body = document.getElementById('modal-busqueda-clientes-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = `
      <div class="py-6 px-4 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <p class="text-sm font-extrabold text-slate-800">No hay coincidencias</p>
        <div class="pt-2">
          <button id="btn-popup-sin-coincidencias-cerrar" type="button"
            class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document
      .getElementById('btn-popup-sin-coincidencias-cerrar')
      ?.addEventListener('click', () => this.cerrarPopupBusqueda());
  }

  async buscarClientesEnPopup(terminoExplicito = null) {
    const input = document.getElementById('clientes-buscar-input');
    const q = (terminoExplicito !== null ? terminoExplicito : input?.value || '').trim();

    // Limpiar inmediatamente la caja de búsqueda para dejarla vacía y lista para la siguiente búsqueda
    if (input) {
      input.value = '';
    }

    const modal = document.getElementById('modal-busqueda-clientes');
    const body = document.getElementById('modal-busqueda-clientes-body');
    if (!modal || !body) return;

    if (q.length < 2) {
      this.clientesEncontrados = [];
      this.mostrarVentanaSinCoincidencias();
      this.renderResultadosEnModulo([]);
      return;
    }

    try {
      modal.classList.remove('hidden');
      body.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Buscando...</div>`;

      const data = await this.api.get('/clientes/buscar', { q });
      this.clientesEncontrados = data.resultados || [];

      if (!this.clientesEncontrados.length) {
        this.mostrarVentanaSinCoincidencias();
        this.renderResultadosEnModulo([]);
        return;
      }

      this.renderPopupCoincidencias(this.clientesEncontrados);
      this.renderResultadosEnModulo(this.clientesEncontrados);
    } catch (_) {
      this.clientesEncontrados = [];
      this.mostrarVentanaSinCoincidencias();
    }
  }

  renderPopupCoincidencias(clientes) {
    const body = document.getElementById('modal-busqueda-clientes-body');
    if (!body) return;

    body.innerHTML = `
      <div class="space-y-2">
        ${this.construirTarjetasCoincidenciasHtml(clientes)}
      </div>
    `;

    body.querySelectorAll('.card-coincidencia-cliente').forEach((card) => {
      card.addEventListener('click', async () => {
        const cid = card.getAttribute('data-open-cliente-id');
        if (cid) {
          this.cerrarPopupBusqueda();
          // Abre directamente el Pop-up grande del perfil del cliente sin cambiar de sección
          await this.abrirExpedienteCliente(cid);
        }
      });
    });
  }

  async abrirExpedienteCliente(
    clienteId,
    abrirFormularioMascota = false,
    mascotaIdPreseleccionada = null
  ) {
    const modalExp = document.getElementById('modal-expediente-cliente');
    const modalBody = document.getElementById('modal-expediente-cliente-body');
    if (!modalExp || !modalBody) return;

    try {
      modalExp.classList.remove('hidden');
      modalBody.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Cargando perfil y expediente del cliente...</div>`;

      const data = await this.api.get(`/clientes/${clienteId}/expediente`);
      this.expedienteActual = data;

      const mascotas = data.mascotas || [];
      if (mascotaIdPreseleccionada) {
        this.mascotaSeleccionadaId = mascotaIdPreseleccionada;
      } else if (
        this.mascotaSeleccionadaId &&
        mascotas.some((m) => m.id === this.mascotaSeleccionadaId)
      ) {
        // Mantiene la mascota seleccionada si pertenece a este cliente
      } else {
        this.mascotaSeleccionadaId = mascotas[0]?.id || null;
      }

      this.renderExpedienteCliente(data, abrirFormularioMascota);
    } catch (err) {
      this.notify(`No se pudo abrir el perfil del cliente: ${err.message}`, 'error');
    }
  }

  formatearFechaHora(isoStr) {
    if (!isoStr) return 'Sin registro';
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return isoStr;
    }
  }

  renderExpedienteCliente(data, mostrarFormMascota = false) {
    const modalBody = document.getElementById('modal-expediente-cliente-body');
    if (!modalBody) return;

    const c = data.cliente || {};
    const res = data.resumen_actividad || {};
    const mascotas = data.mascotas || [];
    const historialCliente = data.historial_citas_cliente || [];
    const telMask = this.enmascararUltimos4(c.telefono, c.ultimos_4_telefono);

    const mascotaActiva =
      mascotas.find((m) => m.id === this.mascotaSeleccionadaId) || mascotas[0] || null;

    modalBody.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
        <!-- Barra superior del Perfil del Dueño -->
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-base font-extrabold text-slate-900">${c.nombre}</h4>
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs font-bold">
                <i class="fa-solid fa-phone mr-1 text-[10px]"></i>${telMask}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              ${c.email ? `<i class="fa-solid fa-envelope mr-1"></i>${c.email} · ` : ''}
              <strong>Notas:</strong> ${c.notas || 'Sin observaciones'}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- Botón Agregar Mascota dentro del perfil del dueño -->
            <button id="btn-toggle-form-mascota-dueno" type="button"
              class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5">
              <i class="fa-solid fa-paw"></i>
              <span>+ Agregar Mascota</span>
            </button>
            <button id="btn-cerrar-expediente-cliente" type="button" title="Cerrar perfil del cliente"
              class="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition">
              Cerrar Perfil
            </button>
          </div>
        </div>

        <!-- Resumen de Actividad con la Estética a Nivel Cliente -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="bg-white rounded-xl p-3 border border-slate-200/90">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Servicios en Estética</span>
            <p class="text-base font-extrabold text-slate-900 mt-0.5">${res.total_citas || 0}</p>
            <p class="text-[10px] text-slate-500">${res.citas_completadas || 0} completadas · ${res.citas_programadas || 0} agendadas</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-slate-200/90">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Inversión Acumulada</span>
            <p class="text-base font-extrabold text-emerald-600 mt-0.5">$${Number(res.total_invertido || 0).toFixed(2)}</p>
            <p class="text-[10px] text-slate-500">Total histórico del cliente</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-slate-200/90">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Última Actividad</span>
            <p class="text-xs font-extrabold text-slate-800 mt-1 truncate">${this.formatearFechaHora(res.ultima_visita)}</p>
            <p class="text-[10px] text-slate-500">Última cita registrada</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-slate-200/90">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Mascotas del Dueño</span>
            <p class="text-base font-extrabold text-blue-600 mt-0.5">${mascotas.length}</p>
            <p class="text-[10px] text-slate-500">Da clic en una para ver detalle</p>
          </div>
        </div>

        <!-- Formulario Desplegable para Registrar Mascota (dentro del perfil del dueño) -->
        <div id="panel-form-mascota-dueno" class="${
          mostrarFormMascota || mascotas.length === 0 ? '' : 'hidden'
        } bg-white rounded-xl p-4 border-2 border-emerald-500/40 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <h5 class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <i class="fa-solid fa-paw text-emerald-600"></i>
              <span>Agregar Mascota al Perfil de <span class="text-emerald-700">${c.nombre}</span></span>
            </h5>
            <button id="btn-cerrar-form-mascota-dueno" type="button" class="text-slate-400 hover:text-slate-600 text-xs font-bold">
              Ocultar
            </button>
          </div>

          <form id="form-crear-mascota-expediente" class="space-y-3">
            <input id="mascota-cliente-id" type="hidden" value="${c.id}" />

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Nombre Mascota *</label>
                <input id="mascota-nombre" type="text" required placeholder="Ej. Rocky"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>

              <!-- Caja de Raza con Buscador y Lista Sugerida Desplegable (incluye Mestiza) -->
              <div class="relative" id="raza-combobox-wrapper">
                <label class="block text-xs font-bold text-slate-600 mb-1">Raza *</label>
                <div class="relative">
                  <input id="mascota-raza" type="text" required autocomplete="off"
                    placeholder="Buscar raza (Ej. Mestiza, Schnauzer...)"
                    class="w-full rounded-xl border border-slate-300 pl-2.5 pr-7 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button id="btn-toggle-raza-dropdown" type="button" tabindex="-1"
                    class="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs">
                    <i class="fa-solid fa-chevron-down"></i>
                  </button>
                </div>
                <div id="raza-sugerencias-dropdown"
                  class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Peso (kg)</label>
                <input id="mascota-peso" type="number" step="0.1" value="8"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Edad</label>
                <input id="mascota-edad" type="text" placeholder="Ej. 3 años"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Temperamento</label>
                <select id="mascota-temperamento" class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs">
                  <option value="Dócil">Dócil</option>
                  <option value="Nervioso">Nervioso</option>
                  <option value="Reactivo / Bozal">Reactivo / Bozal</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Alergias Médicas</label>
                <input id="mascota-alergias" type="text" value="Ninguna"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1"># Navaja</label>
                <input id="mascota-navaja" type="text" placeholder="Ej. #7F"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Shampoo</label>
                <input id="mascota-shampoo" type="text" placeholder="Ej. Avena Hipoalergénico"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Estilo de Corte</label>
                <input id="mascota-corte" type="text" placeholder="Ej. Osito / Estándar"
                  class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs" />
              </div>
            </div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition">
              <i class="fa-solid fa-barcode mr-1"></i>Guardar Mascota y Generar Código PET-
            </button>
          </form>
        </div>

        <!-- Sección de Mascotas del Cliente (Cada caja incluye botón para Agregar Cita) -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <i class="fa-solid fa-shield-dog text-blue-600 mr-1"></i>Mascotas (${mascotas.length})
            </h5>
          </div>

          ${
            mascotas.length
              ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  ${mascotas
                    .map((m) => {
                      const isSel = mascotaActiva && m.id === mascotaActiva.id;
                      return `
                        <div class="rounded-xl border transition p-3 flex flex-col justify-between gap-2.5 ${
                          isSel
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white hover:bg-blue-50/40 text-slate-800 border-slate-200 hover:border-blue-400'
                        }">
                          <div data-select-pet-id="${m.id}" class="btn-ver-detalle-mascota cursor-pointer flex items-center justify-between gap-2">
                            <div class="min-w-0">
                              <p class="font-extrabold text-xs truncate flex items-center gap-1.5">
                                <i class="fa-solid fa-paw ${isSel ? 'text-blue-200' : 'text-blue-600'}"></i>
                                <span>${m.nombre}</span>
                              </p>
                              <p class="text-[11px] ${isSel ? 'text-blue-100' : 'text-slate-500'} truncate">
                                ${m.raza} · ${m.peso_kg || 0} kg
                              </p>
                            </div>
                            <div class="text-right shrink-0">
                              <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                                isSel ? 'bg-blue-900/60 text-emerald-300' : 'bg-slate-900 text-emerald-400'
                              } block">
                                ${m.codigo_barras || 'PET-'}
                              </span>
                              <span class="text-[10px] ${isSel ? 'text-blue-100' : 'text-slate-400'}">
                                ${m.total_citas || 0} citas
                              </span>
                            </div>
                          </div>

                          <div class="pt-2 border-t ${
                            isSel ? 'border-blue-500/60' : 'border-slate-100'
                          } flex items-center justify-between gap-2">
                            <button type="button" data-select-pet-id="${m.id}"
                              class="btn-ver-detalle-mascota text-[11px] font-semibold ${
                                isSel ? 'text-blue-100 hover:text-white' : 'text-slate-500 hover:text-blue-600'
                              } transition">
                              Ver detalle
                            </button>
                            <button type="button"
                              data-agendar-pet-id="${m.id}"
                              data-agendar-pet-nombre="${m.nombre}"
                              data-agendar-pet-raza="${m.raza}"
                              data-agendar-cliente-nombre="${c.nombre}"
                              class="btn-agendar-cita-mascota px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition inline-flex items-center gap-1 ${
                                isSel
                                  ? 'bg-white text-blue-700 hover:bg-blue-50 shadow-2xs'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                              }">
                              <i class="fa-solid fa-calendar-plus text-[10px]"></i>
                              <span>Agregar Cita</span>
                            </button>
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>`
              : `<div class="p-4 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
                  Este cliente aún no tiene mascotas registradas.
                </div>`
          }

          <!-- Panel de Detalle Clínico e Historial de la Mascota Seleccionada -->
          <div id="expediente-detalle-mascota-box">
            ${mascotaActiva ? this.renderDetalleMascotaHtml(mascotaActiva, c.nombre) : ''}
          </div>
        </div>

        <!-- Historial General de Actividad con la Estética a Nivel Cliente -->
        <div class="bg-white rounded-xl p-4 border border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <h5 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <i class="fa-solid fa-clock-rotate-left text-indigo-600 mr-1"></i>Actividad en la Estética (Nivel Cliente)
            </h5>
            <span class="text-[11px] font-semibold text-slate-500">${historialCliente.length} registros</span>
          </div>

          ${
            historialCliente.length
              ? `<div class="overflow-x-auto max-h-56 overflow-y-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="border-b border-slate-200 text-[10px] uppercase text-slate-400">
                        <th class="py-1.5 px-2">Fecha y Hora</th>
                        <th class="py-1.5 px-2">Mascota</th>
                        <th class="py-1.5 px-2">Servicio</th>
                        <th class="py-1.5 px-2">Estilista</th>
                        <th class="py-1.5 px-2">Estado</th>
                        <th class="py-1.5 px-2 text-right">Precio</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${historialCliente
                        .map((cita) => {
                          const est = String(cita.estado || 'Programada');
                          const badge =
                            est.toLowerCase() === 'completada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : est.toLowerCase() === 'cancelada'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-800';
                          return `
                            <tr class="hover:bg-slate-50">
                              <td class="py-2 px-2 font-medium text-slate-700 whitespace-nowrap">${this.formatearFechaHora(
                                cita.fecha_hora
                              )}</td>
                              <td class="py-2 px-2 font-bold text-slate-900">${cita.mascota_nombre} <span class="text-[10px] text-slate-400 font-normal">(${
                            cita.mascota_raza
                          })</span></td>
                              <td class="py-2 px-2 text-slate-700">${cita.servicio || 'Servicio'}</td>
                              <td class="py-2 px-2 text-slate-600">${cita.estilista || 'Por asignar'}</td>
                              <td class="py-2 px-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badge}">${est}</span></td>
                              <td class="py-2 px-2 text-right font-extrabold text-slate-900">$${Number(
                                cita.precio || 0
                              ).toFixed(2)}</td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : `<p class="text-xs text-slate-400 italic py-2">Aún no hay citas o servicios registrados para este cliente.</p>`
          }
        </div>
      </div>
    `;

    this.bindExpedienteEvents(data);
  }

  renderDetalleMascotaHtml(m, clienteNombre = '') {
    const visitas = Number(m.visitas_acumuladas || m.citas_completadas || 0);
    const meta = Number(m.meta_lealtad || 5);
    const pct = Math.min(100, Math.round(((visitas % meta) / meta) * 100));
    const histMascota = m.historial_citas || [];

    return `
      <div class="bg-white rounded-xl p-4 border-2 border-blue-500/30 shadow-xs space-y-3 mt-2">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm">
              <i class="fa-solid fa-dog"></i>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h6 class="text-sm font-extrabold text-slate-900">Detalle de Mascota: ${m.nombre}</h6>
                <span class="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold">${m.raza}</span>
                <span class="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-emerald-400">
                  <i class="fa-solid fa-barcode mr-1"></i>${m.codigo_barras || 'SIN-CODIGO'}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Peso: <strong>${m.peso_kg || 0} kg</strong> ·
                Edad: <strong>${m.edad || 'No especificada'}</strong> ·
                Servicios completados: <strong>${m.citas_completadas || 0}</strong> ($${Number(
      m.total_invertido || 0
    ).toFixed(2)})
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button"
              data-agendar-pet-id="${m.id}"
              data-agendar-pet-nombre="${m.nombre}"
              data-agendar-pet-raza="${m.raza}"
              data-agendar-cliente-nombre="${clienteNombre}"
              class="btn-agendar-cita-mascota px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5">
              <i class="fa-solid fa-calendar-plus"></i>
              <span>Agregar Cita</span>
            </button>
            <div class="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
              <span class="text-[10px] font-bold uppercase text-slate-400 block">Tarjeta de Lealtad</span>
              <span class="text-xs font-extrabold text-blue-700">${visitas} visitas acumuladas (Meta: ${meta})</span>
              <div class="w-28 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1 ml-auto">
                <div class="h-full bg-emerald-500 rounded-full" style="width: ${pct}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ficha Clínica y Parámetros de Estética -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Temperamento</span>
            <span class="font-bold text-slate-800">${m.temperamento || 'Dócil'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-red-50/60 border border-red-200/70">
            <span class="text-[10px] font-bold uppercase text-red-500 block">Alergias Médicas</span>
            <span class="font-bold text-red-800">${m.alergias_medicas || 'Ninguna'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block"># de Navaja</span>
            <span class="font-bold text-slate-800">${m.numero_navaja || 'Estándar'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Shampoo Asignado</span>
            <span class="font-bold text-slate-800">${m.tipo_shampoo || 'Neutro / General'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Estilo de Corte</span>
            <span class="font-bold text-slate-800">${m.estilo_corte || 'Estándar'}</span>
          </div>
        </div>

        <!-- Historial individual de esta mascota -->
        <div class="space-y-1.5 pt-1">
          <p class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
            <i class="fa-solid fa-notes-medical text-blue-600 mr-1"></i>Historial de Citas de ${m.nombre} (${histMascota.length})
          </p>
          ${
            histMascota.length
              ? `<div class="space-y-1.5 max-h-40 overflow-y-auto">
                  ${histMascota
                    .map(
                      (c) => `
                      <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span class="font-bold text-slate-800">${this.formatearFechaHora(c.fecha_hora)}</span>
                          <span class="mx-1 text-slate-300">·</span>
                          <span class="font-semibold text-blue-700">${c.servicio}</span>
                          <span class="text-slate-500">con ${c.estilista || 'Por asignar'}</span>
                          ${c.notas ? `<p class="text-[11px] text-slate-500 mt-0.5">Notas: ${c.notas}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700">${
                            c.estado
                          }</span>
                          <span class="font-extrabold text-slate-900">$${Number(c.precio || 0).toFixed(2)}</span>
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
              : `<p class="text-xs text-slate-400 italic">${m.nombre} aún no registra citas en el historial.</p>`
          }
        </div>
      </div>
    `;
  }

  bindExpedienteEvents(data) {
    const modalBody = document.getElementById('modal-expediente-cliente-body');
    if (!modalBody) return;

    const btnCerrarExp = document.getElementById('btn-cerrar-expediente-cliente');
    if (btnCerrarExp) {
      btnCerrarExp.addEventListener('click', () => {
        this.cerrarPopupExpediente();
      });
    }

    const panelFormMascota = document.getElementById('panel-form-mascota-dueno');
    const btnToggleForm = document.getElementById('btn-toggle-form-mascota-dueno');
    const btnCerrarForm = document.getElementById('btn-cerrar-form-mascota-dueno');

    if (btnToggleForm && panelFormMascota) {
      btnToggleForm.addEventListener('click', () => {
        panelFormMascota.classList.toggle('hidden');
        if (!panelFormMascota.classList.contains('hidden')) {
          document.getElementById('mascota-nombre')?.focus();
        }
      });
    }

    if (btnCerrarForm && panelFormMascota) {
      btnCerrarForm.addEventListener('click', () => {
        panelFormMascota.classList.add('hidden');
      });
    }

    // Inicializar Combobox buscable de Razas (incluyendo "Mestiza")
    this.initRazaSearchableDropdown();

    // Formulario de crear mascota dentro del expediente del dueño
    const formMascota = document.getElementById('form-crear-mascota-expediente');
    if (formMascota) {
      formMascota.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearMascotaDesdeExpediente(data.cliente?.id);
      });
    }

    // Selección de mascota para ver su detalle clínico
    modalBody.querySelectorAll('.btn-ver-detalle-mascota').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-select-pet-id');
        if (pid) {
          this.mascotaSeleccionadaId = pid;
          this.renderExpedienteCliente(this.expedienteActual, false);
        }
      });
    });

    // Botón "+ Agregar Cita" dentro de cada caja de mascota
    modalBody.querySelectorAll('.btn-agendar-cita-mascota').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = btn.getAttribute('data-agendar-pet-id');
        const petNombre = btn.getAttribute('data-agendar-pet-nombre') || 'Mascota';
        const petRaza = btn.getAttribute('data-agendar-pet-raza') || '';
        const cliNombre = btn.getAttribute('data-agendar-cliente-nombre') || '';
        if (petId) {
          this.abrirModalAgendarCitaMascota({
            id: petId,
            nombre: petNombre,
            raza: petRaza,
            cliente_nombre: cliNombre,
          });
        }
      });
    });
  }

  initModalAgendarCitaEvents() {
    const modal = document.getElementById('modal-agendar-cita-mascota');
    const btnCerrar = document.getElementById('btn-cerrar-modal-agendar-cita-mascota');
    const btnCancelar = document.getElementById('btn-cancelar-modal-cita-mascota');
    const btnRecalcular = document.getElementById('btn-modal-cita-recalcular');
    const selectServicio = document.getElementById('modal-cita-servicio-select');
    const inputFecha = document.getElementById('modal-cita-fecha');
    const formCita = document.getElementById('form-modal-cita-mascota');

    const cerrar = () => modal?.classList.add('hidden');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrar);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrar();
      });
    }

    if (btnRecalcular) {
      btnRecalcular.addEventListener('click', () => this.consultarDisponibilidadModalCita());
    }
    if (inputFecha) {
      inputFecha.addEventListener('change', () => this.consultarDisponibilidadModalCita());
    }
    if (selectServicio) {
      selectServicio.addEventListener('change', (e) => {
        const srv = this.serviciosCatalogo.find((s) => s.nombre === e.target.value);
        if (srv) {
          const durEl = document.getElementById('modal-cita-duracion');
          const precioEl = document.getElementById('modal-cita-precio');
          if (durEl) durEl.value = srv.duracion_minutos || 60;
          if (precioEl) precioEl.value = srv.precio_base || 0;
          this.consultarDisponibilidadModalCita();
        }
      });
    }
    if (formCita) {
      formCita.addEventListener('submit', (e) => {
        e.preventDefault();
        this.guardarCitaDesdeModalMascota();
      });
    }
  }

  async abrirModalAgendarCitaMascota(mascotaInfo) {
    const modal = document.getElementById('modal-agendar-cita-mascota');
    const idInput = document.getElementById('modal-cita-mascota-id');
    const labelEl = document.getElementById('modal-cita-mascota-label');
    const fechaInput = document.getElementById('modal-cita-fecha');
    const horaInput = document.getElementById('modal-cita-hora-seleccionada');
    const notasInput = document.getElementById('modal-cita-notas');
    if (!modal || !idInput) return;

    this.slotSeleccionadoModalCita = null;
    idInput.value = mascotaInfo.id;
    if (horaInput) horaInput.value = '';
    if (notasInput) notasInput.value = '';
    if (labelEl) {
      labelEl.textContent = `${mascotaInfo.nombre} (${mascotaInfo.raza}) · Dueño: ${mascotaInfo.cliente_nombre}`;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = today;
    }

    modal.classList.remove('hidden');

    await this.cargarCatalogosParaModalCita();
    await this.consultarDisponibilidadModalCita();
  }

  async cargarCatalogosParaModalCita() {
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

      const selectServicio = document.getElementById('modal-cita-servicio-select');
      if (selectServicio && this.serviciosCatalogo.length) {
        selectServicio.innerHTML = this.serviciosCatalogo
          .map(
            (s) =>
              `<option value="${s.nombre}">${s.nombre} (${s.duracion_minutos} min - $${s.precio_base})</option>`
          )
          .join('');
        const first = this.serviciosCatalogo[0];
        const durEl = document.getElementById('modal-cita-duracion');
        const precioEl = document.getElementById('modal-cita-precio');
        if (durEl) durEl.value = first.duracion_minutos || 60;
        if (precioEl) precioEl.value = first.precio_base || 0;
      }

      const selectEstilista = document.getElementById('modal-cita-estilista');
      if (selectEstilista) {
        selectEstilista.innerHTML = [
          '<option value="Por asignar">Por asignar (Automático)</option>',
          ...this.estilistasSucursal.map(
            (u) => `<option value="${u.nombre}">${u.nombre} (${u.rol})</option>`
          ),
        ].join('');
      }
    } catch (_) {}
  }

  async consultarDisponibilidadModalCita() {
    const fechaInput = document.getElementById('modal-cita-fecha');
    const durInput = document.getElementById('modal-cita-duracion');
    const slotsContainer = document.getElementById('modal-cita-slots-container');
    if (!fechaInput || !slotsContainer) return;

    const fecha = fechaInput.value || new Date().toISOString().slice(0, 10);
    const duracion_minutos = Number(durInput?.value || 60);

    try {
      slotsContainer.innerHTML = `<div class="col-span-full text-center py-3 text-slate-400">Calculando horarios...</div>`;
      const data = await this.api.get('/disponibilidad', {
        fecha,
        duracion_minutos,
      });

      if (!data.abierto) {
        slotsContainer.innerHTML = `
          <div class="col-span-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <strong>Sucursal cerrada:</strong> ${data.motivo_cierre || 'Día inhábil'}
          </div>`;
        return;
      }

      const slots = data.slots || [];
      if (!slots.length) {
        slotsContainer.innerHTML = `<div class="col-span-full p-3 text-slate-500 text-xs">No hay horarios disponibles.</div>`;
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
              <div class="font-bold text-xs">${s.hora}</div>
              <div class="text-[10px] ${s.disponible ? 'text-emerald-600' : 'text-red-500'}">
                ${s.disponible ? `${s.cupos_disponibles} cupo(s)` : 'Agotado'}
              </div>
            </button>`;
        })
        .join('');

      slotsContainer.querySelectorAll('.slot-chip:not(:disabled)').forEach((btn) => {
        btn.addEventListener('click', () => {
          slotsContainer
            .querySelectorAll('.slot-chip')
            .forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.slotSeleccionadoModalCita = btn.getAttribute('data-hora');
          const horaInput = document.getElementById('modal-cita-hora-seleccionada');
          if (horaInput) horaInput.value = this.slotSeleccionadoModalCita;
        });
      });
    } catch (err) {
      slotsContainer.innerHTML = `<div class="col-span-full text-red-600 text-xs">Error al consultar disponibilidad: ${err.message}</div>`;
    }
  }

  async guardarCitaDesdeModalMascota() {
    const mascotaId = document.getElementById('modal-cita-mascota-id')?.value;
    const fecha = document.getElementById('modal-cita-fecha')?.value;
    const hora =
      document.getElementById('modal-cita-hora-seleccionada')?.value ||
      this.slotSeleccionadoModalCita;
    const servicio =
      document.getElementById('modal-cita-servicio-select')?.value || 'Baño Básico';
    const duracion = Number(document.getElementById('modal-cita-duracion')?.value || 60);
    const precio = Number(document.getElementById('modal-cita-precio')?.value || 0);
    const estilista =
      document.getElementById('modal-cita-estilista')?.value || 'Por asignar';
    const notas = document.getElementById('modal-cita-notas')?.value || '';

    if (!mascotaId) {
      this.notify('Mascota no identificada.', 'warning');
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

      this.notify('Cita agendada exitosamente para la mascota.', 'success');
      document.getElementById('modal-agendar-cita-mascota')?.classList.add('hidden');

      if (this.expedienteActual?.cliente?.id) {
        await this.abrirExpedienteCliente(
          this.expedienteActual.cliente.id,
          false,
          mascotaId
        );
      }

      if (window.petGroomingApp?.views?.agenda) {
        await window.petGroomingApp.views.agenda.cargarCitas();
      }
    } catch (err) {
      this.notify(`No se pudo agendar la cita: ${err.message}`, 'error');
    }
  }

  initRazaSearchableDropdown() {
    const inputRaza = document.getElementById('mascota-raza');
    const btnToggle = document.getElementById('btn-toggle-raza-dropdown');
    const dropdown = document.getElementById('raza-sugerencias-dropdown');
    const wrapper = document.getElementById('raza-combobox-wrapper');

    if (!inputRaza || !dropdown || !wrapper) return;

    const renderOpciones = (filtro = '') => {
      const term = (filtro || '').trim().toLowerCase();
      const coincidencias = ClientesView.RAZAS_SUGERIDAS.filter((r) =>
        r.toLowerCase().includes(term)
      );

      if (!coincidencias.length) {
        dropdown.innerHTML = `
          <div class="px-3 py-2 text-[11px] text-slate-500">
            Raza personalizada: <strong class="text-slate-800">"${inputRaza.value}"</strong>
          </div>`;
        return;
      }

      dropdown.innerHTML = coincidencias
        .map((raza) => {
          const esMestiza = raza.toLowerCase().startsWith('mestiza');
          return `
            <button type="button" data-raza-option="${raza}"
              class="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-800 flex items-center justify-between transition ${
                esMestiza ? 'font-extrabold text-emerald-700 bg-emerald-50/40' : 'text-slate-700 font-medium'
              }">
              <span>${raza}</span>
              ${
                esMestiza
                  ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Sugerida</span>'
                  : ''
              }
            </button>
          `;
        })
        .join('');

      dropdown.querySelectorAll('[data-raza-option]').forEach((optBtn) => {
        optBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const val = optBtn.getAttribute('data-raza-option') || '';
          inputRaza.value = val;
          dropdown.classList.add('hidden');
        });
      });
    };

    inputRaza.addEventListener('focus', () => {
      renderOpciones(inputRaza.value);
      dropdown.classList.remove('hidden');
    });

    inputRaza.addEventListener('input', () => {
      renderOpciones(inputRaza.value);
      dropdown.classList.remove('hidden');
    });

    inputRaza.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.add('hidden');
      }, 150);
    });

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
          renderOpciones('');
          dropdown.classList.remove('hidden');
          inputRaza.focus();
        } else {
          dropdown.classList.add('hidden');
        }
      });
    }
  }

  async crearCliente() {
    const nombre = document.getElementById('cliente-nombre')?.value.trim();
    const telefono = document.getElementById('cliente-telefono')?.value.trim();
    const email = document.getElementById('cliente-email')?.value.trim();
    const notas = document.getElementById('cliente-notas')?.value.trim();

    if (!nombre || !telefono) {
      this.notify('Nombre y teléfono son obligatorios.', 'warning');
      return;
    }

    try {
      const res = await this.api.post('/clientes', {
        nombre,
        telefono,
        email,
        notas,
      });
      const nuevo = res.cliente;
      this.notify(`Cliente ${nuevo.nombre} registrado exitosamente.`, 'success');
      document.getElementById('form-crear-cliente')?.reset();
      document.getElementById('modal-nuevo-cliente')?.classList.add('hidden');

      if (nuevo?.id) {
        await this.abrirExpedienteCliente(nuevo.id, true);
      }
    } catch (err) {
      this.notify(`Error al registrar cliente: ${err.message}`, 'error');
    }
  }

  async crearMascotaDesdeExpediente(clienteIdExplicito = null) {
    const cliente_id =
      clienteIdExplicito || document.getElementById('mascota-cliente-id')?.value.trim();
    const nombre = document.getElementById('mascota-nombre')?.value.trim();
    const raza = document.getElementById('mascota-raza')?.value.trim();
    const peso_kg = Number(document.getElementById('mascota-peso')?.value || 0);
    const edad = document.getElementById('mascota-edad')?.value.trim() || '';
    const alergias_medicas =
      document.getElementById('mascota-alergias')?.value.trim() || 'Ninguna';
    const temperamento =
      document.getElementById('mascota-temperamento')?.value || 'Dócil';
    const numero_navaja =
      document.getElementById('mascota-navaja')?.value.trim() || '';
    const tipo_shampoo =
      document.getElementById('mascota-shampoo')?.value.trim() || '';
    const estilo_corte =
      document.getElementById('mascota-corte')?.value.trim() || '';

    if (!cliente_id) {
      this.notify('Abre primero el perfil del dueño de la mascota.', 'warning');
      return;
    }
    if (!nombre || !raza) {
      this.notify('El nombre y la raza de la mascota son obligatorios.', 'warning');
      return;
    }

    try {
      const res = await this.api.post('/mascotas', {
        cliente_id,
        nombre,
        raza,
        peso_kg,
        edad,
        alergias_medicas,
        temperamento,
        numero_navaja,
        tipo_shampoo,
        estilo_corte,
      });

      this.notify(
        `Mascota "${nombre}" agregada al perfil con código: ${res.codigo_barras}`,
        'success'
      );

      const nuevaMascotaId = res.mascota?.id || null;
      await this.abrirExpedienteCliente(cliente_id, false, nuevaMascotaId);
    } catch (err) {
      this.notify(`Error al registrar mascota: ${err.message}`, 'error');
    }
  }
}
