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
    this.padronClientes = [];
    this.padronMascotas = [];
    this.modoTabla = 'clientes'; // 'clientes' | 'mascotas'
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

    // 4. Switch Clientes <-> Mascotas y filtros de encabezados en el módulo Clientes y Expedientes
    this.initTablaPadronEvents();

    // 5. Pop-up de Agregar Cita para Mascota
    this.initModalAgendarCitaEvents();
  }

  async load() {
    await this.cargarPadronGeneral();
  }

  initTablaPadronEvents() {
    const btnSwitchClientes = document.getElementById('btn-switch-tabla-clientes');
    const btnSwitchMascotas = document.getElementById('btn-switch-tabla-mascotas');
    const btnToggleSwitch = document.getElementById('btn-toggle-switch-padron');
    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros-padron');
    const btnRecargar = document.getElementById('btn-recargar-padron');

    if (btnSwitchClientes) {
      btnSwitchClientes.addEventListener('click', () => this.cambiarModoTabla('clientes'));
    }
    if (btnSwitchMascotas) {
      btnSwitchMascotas.addEventListener('click', () => this.cambiarModoTabla('mascotas'));
    }
    if (btnToggleSwitch) {
      btnToggleSwitch.addEventListener('click', () => {
        const nuevoModo = this.modoTabla === 'clientes' ? 'mascotas' : 'clientes';
        this.cambiarModoTabla(nuevoModo);
      });
    }

    if (btnLimpiarFiltros) {
      btnLimpiarFiltros.addEventListener('click', () => {
        document
          .querySelectorAll('[data-filter-cliente], [data-filter-mascota]')
          .forEach((inp) => {
            inp.value = '';
          });
        this.renderTablaClientesFiltrada();
        this.renderTablaMascotasFiltrada();
      });
    }

    if (btnRecargar) {
      btnRecargar.addEventListener('click', () => this.cargarPadronGeneral());
    }

    document.querySelectorAll('[data-filter-cliente]').forEach((inp) => {
      inp.addEventListener('input', () => this.renderTablaClientesFiltrada());
    });

    document.querySelectorAll('[data-filter-mascota]').forEach((inp) => {
      inp.addEventListener('input', () => this.renderTablaMascotasFiltrada());
    });
  }

  cambiarModoTabla(modo) {
    this.modoTabla = modo === 'mascotas' ? 'mascotas' : 'clientes';
    const esMascotas = this.modoTabla === 'mascotas';

    const contClientes = document.getElementById('contenedor-tabla-bd-clientes');
    const contMascotas = document.getElementById('contenedor-tabla-bd-mascotas');
    const btnClientes = document.getElementById('btn-switch-tabla-clientes');
    const btnMascotas = document.getElementById('btn-switch-tabla-mascotas');
    const countCli = document.getElementById('count-padron-clientes');
    const countPet = document.getElementById('count-padron-mascotas');
    const knob = document.getElementById('knob-switch-padron');

    if (contClientes) contClientes.classList.toggle('hidden', esMascotas);
    if (contMascotas) contMascotas.classList.toggle('hidden', !esMascotas);

    if (btnClientes) {
      btnClientes.className = esMascotas
        ? 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900'
        : 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 bg-blue-600 text-white shadow-2xs';
    }
    if (btnMascotas) {
      btnMascotas.className = esMascotas
        ? 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 bg-blue-600 text-white shadow-2xs'
        : 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
    }

    if (countCli) {
      countCli.className = esMascotas
        ? 'px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]'
        : 'px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]';
    }
    if (countPet) {
      countPet.className = esMascotas
        ? 'px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]'
        : 'px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]';
    }

    if (knob) {
      knob.className = `w-3.5 h-3.5 rounded-full bg-blue-600 transition-transform duration-200 ${
        esMascotas ? 'translate-x-4' : 'translate-x-0'
      }`;
    }
  }

  async cargarPadronGeneral() {
    try {
      const data = await this.api.get('/clientes-mascotas/padron');
      this.padronClientes = data.clientes || [];
      this.padronMascotas = data.mascotas || [];

      const countCli = document.getElementById('count-padron-clientes');
      const countPet = document.getElementById('count-padron-mascotas');
      if (countCli) countCli.textContent = String(this.padronClientes.length);
      if (countPet) countPet.textContent = String(this.padronMascotas.length);

      this.renderTablaClientesFiltrada();
      this.renderTablaMascotasFiltrada();
    } catch (err) {
      console.warn('Error al cargar padrón de clientes y mascotas:', err);
    }
  }

  obtenerFiltrosActivos(selectorAttr) {
    const filtros = {};
    document.querySelectorAll(`[${selectorAttr}]`).forEach((inp) => {
      const key = inp.getAttribute(selectorAttr);
      const val = (inp.value || '').trim().toLowerCase();
      if (key && val) {
        filtros[key] = val;
      }
    });
    return filtros;
  }

  renderTablaClientesFiltrada() {
    const tbody = document.getElementById('tbody-padron-clientes');
    if (!tbody) return;

    const filtros = this.obtenerFiltrosActivos('data-filter-cliente');
    const lista = (this.padronClientes || []).filter((c) => {
      const fechaStr = this.formatearFechaHora(c.created_at).toLowerCase();
      const mapCampos = {
        nombre: String(c.nombre || '').toLowerCase(),
        telefono: `${c.telefono || ''} ${c.telefono_enmascarado || ''} ${c.ultimos_4_telefono || ''}`.toLowerCase(),
        email: String(c.email || '').toLowerCase(),
        mascotas_resumen: String(c.mascotas_resumen || '').toLowerCase(),
        notas: String(c.notas || '').toLowerCase(),
        created_at: `${c.created_at || ''} ${fechaStr}`,
      };

      return Object.entries(filtros).every(([campo, term]) =>
        (mapCampos[campo] || '').includes(term)
      );
    });

    if (!lista.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400 text-xs">
            No se encontraron clientes con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista
      .map((c) => {
        const mascotas = c.mascotas || [];
        const chips = mascotas.length
          ? mascotas
              .map(
                (m) =>
                  `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[10px] font-bold mr-1 mb-1">
                    <i class="fa-solid fa-paw text-[9px]"></i>${m.nombre} (${m.raza})
                  </span>`
              )
              .join('')
          : `<span class="text-slate-400 italic text-[11px]">Sin mascotas</span>`;

        return `
          <tr class="hover:bg-blue-50/40 transition">
            <td class="p-2.5 font-extrabold text-slate-900">
              <button type="button" data-open-cliente-id="${c.id}" class="btn-tabla-abrir-cliente text-left hover:text-blue-600 transition flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-slate-900 text-white text-[10px] font-extrabold inline-flex items-center justify-center shrink-0">
                  ${(c.nombre || 'C').charAt(0).toUpperCase()}
                </span>
                <span>${c.nombre}</span>
              </button>
            </td>
            <td class="p-2.5 font-mono text-slate-700 font-semibold">${c.telefono || '-'}</td>
            <td class="p-2.5 text-slate-600">${c.email || '-'}</td>
            <td class="p-2.5">${chips}</td>
            <td class="p-2.5 text-slate-600">${c.notas || '-'}</td>
            <td class="p-2.5 text-slate-500 whitespace-nowrap">${this.formatearFechaHora(c.created_at)}</td>
            <td class="p-2.5 text-right whitespace-nowrap">
              <button type="button" data-open-cliente-id="${c.id}"
                class="btn-tabla-abrir-cliente px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] transition inline-flex items-center gap-1.5">
                <i class="fa-solid fa-folder-open text-[10px]"></i>
                <span>Ver Perfil</span>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.btn-tabla-abrir-cliente').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-open-cliente-id');
        if (cid) this.abrirExpedienteCliente(cid);
      });
    });
  }

  renderTablaMascotasFiltrada() {
    const tbody = document.getElementById('tbody-padron-mascotas');
    if (!tbody) return;

    const filtros = this.obtenerFiltrosActivos('data-filter-mascota');
    const lista = (this.padronMascotas || []).filter((m) => {
      const mapCampos = {
        codigo_barras: String(m.codigo_barras || '').toLowerCase(),
        nombre: String(m.nombre || '').toLowerCase(),
        raza: String(m.raza || '').toLowerCase(),
        cliente_nombre: `${m.cliente_nombre || ''} ${m.cliente_telefono || ''}`.toLowerCase(),
        peso_edad: `${m.peso_kg || 0} kg ${m.edad || ''}`.toLowerCase(),
        clinico: `${m.temperamento || ''} ${m.alergias_medicas || ''}`.toLowerCase(),
        estetica: `${m.estilo_corte || ''} ${m.tipo_shampoo || ''} ${m.numero_navaja || ''}`.toLowerCase(),
        visitas_acumuladas: String(m.visitas_acumuladas || 0).toLowerCase(),
      };

      return Object.entries(filtros).every(([campo, term]) =>
        (mapCampos[campo] || '').includes(term)
      );
    });

    if (!lista.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 text-center text-slate-400 text-xs">
            No se encontraron mascotas con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista
      .map((m) => {
        return `
          <tr class="hover:bg-blue-50/40 transition">
            <td class="p-2.5">
              <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-emerald-400">
                ${m.codigo_barras || 'SIN-COD'}
              </span>
            </td>
            <td class="p-2.5 font-extrabold text-slate-900">${m.nombre}</td>
            <td class="p-2.5 font-semibold text-blue-700">${m.raza}</td>
            <td class="p-2.5">
              <div class="font-bold text-slate-800">${m.cliente_nombre}</div>
              <div class="font-mono text-[10px] text-slate-400">${m.cliente_telefono || ''}</div>
            </td>
            <td class="p-2.5 text-slate-700">
              <strong>${m.peso_kg || 0} kg</strong>
              <span class="text-slate-400 block text-[10px]">${m.edad || 'Sin edad'}</span>
            </td>
            <td class="p-2.5">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">${m.temperamento || 'Dócil'}</span>
              <span class="block text-[10px] text-red-600 mt-0.5">Alergias: ${m.alergias_medicas || 'Ninguna'}</span>
            </td>
            <td class="p-2.5 text-[11px] text-slate-600">
              <div><strong>Corte:</strong> ${m.estilo_corte || 'Sin especificar'}</div>
              <div class="text-[10px] text-slate-500">Navaja: ${m.numero_navaja || 'Sin especificar'} · Shampoo: ${m.tipo_shampoo || 'Sin especificar'}</div>
            </td>
            <td class="p-2.5 font-extrabold text-blue-700 text-center">
              ${m.visitas_acumuladas || 0} / ${m.meta_lealtad || 5}
            </td>
            <td class="p-2.5 text-right whitespace-nowrap space-x-1">
              <button type="button"
                data-open-cliente-id="${m.cliente_id}"
                data-open-pet-id="${m.id}"
                class="btn-tabla-abrir-mascota px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white font-bold text-[11px] transition inline-flex items-center gap-1">
                <i class="fa-solid fa-folder-open text-[10px]"></i>
                <span>Perfil</span>
              </button>
              <button type="button"
                data-agendar-pet-id="${m.id}"
                data-agendar-pet-nombre="${m.nombre}"
                data-agendar-pet-raza="${m.raza}"
                data-agendar-cliente-nombre="${m.cliente_nombre}"
                class="btn-tabla-agendar-cita px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition inline-flex items-center gap-1">
                <i class="fa-solid fa-calendar-plus text-[10px]"></i>
                <span>Agregar Cita</span>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.btn-tabla-abrir-mascota').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-open-cliente-id');
        const pid = btn.getAttribute('data-open-pet-id');
        if (cid) this.abrirExpedienteCliente(cid, false, pid);
      });
    });

    tbody.querySelectorAll('.btn-tabla-agendar-cita').forEach((btn) => {
      btn.addEventListener('click', () => {
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
      return;
    }

    try {
      modal.classList.remove('hidden');
      body.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Buscando...</div>`;

      const data = await this.api.get('/clientes/buscar', { q });
      this.clientesEncontrados = data.resultados || [];

      if (!this.clientesEncontrados.length) {
        this.mostrarVentanaSinCoincidencias();
        return;
      }

      this.renderPopupCoincidencias(this.clientesEncontrados);
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
    const s = String(isoStr).trim();
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      const [, y, m, d, hh, mm] = match;
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mesTxt = meses[Math.max(0, Math.min(11, Number(m) - 1))];
      return `${d} ${mesTxt} ${y}, ${hh}:${mm}`;
    }
    try {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return s;
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
            <span class="font-bold text-slate-800">${m.numero_navaja || 'Sin especificar'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Shampoo Asignado</span>
            <span class="font-bold text-slate-800">${m.tipo_shampoo || 'Sin especificar'}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Estilo de Corte</span>
            <span class="font-bold text-slate-800">${m.estilo_corte || 'Sin especificar'}</span>
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

  _actualizarBadgeSeleccionModalCita() {
    const badge = document.getElementById('modal-cita-seleccion-badge');
    const fecha = document.getElementById('modal-cita-fecha')?.value || '';
    const hora =
      this.slotSeleccionadoModalCita ||
      document.getElementById('modal-cita-hora-seleccionada')?.value ||
      '';
    if (!badge) return;

    if (fecha && hora) {
      badge.className =
        'px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-extrabold';
      badge.innerHTML = `<i class="fa-solid fa-check mr-1"></i>${fecha} a las ${hora} hrs`;
    } else {
      badge.className =
        'px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-extrabold';
      badge.textContent = 'Selecciona un bloque disponible';
    }
  }

  initModalAgendarCitaEvents() {
    this.modalCitaVistaSemana = false;

    const modal = document.getElementById('modal-agendar-cita-mascota');
    const btnCerrar = document.getElementById('btn-cerrar-modal-agendar-cita-mascota');
    const btnCancelar = document.getElementById('btn-cancelar-modal-cita-mascota');
    const btnRecalcular = document.getElementById('btn-modal-cita-recalcular');
    const btnToggleSemana = document.getElementById('btn-modal-cita-toggle-semana');
    const btnPrev = document.getElementById('btn-modal-cita-prev');
    const btnHoy = document.getElementById('btn-modal-cita-hoy');
    const btnNext = document.getElementById('btn-modal-cita-next');
    const selectServicio = document.getElementById('modal-cita-servicio-select');
    const inputFecha = document.getElementById('modal-cita-fecha');
    const inputDuracion = document.getElementById('modal-cita-duracion');
    const formCita = document.getElementById('form-modal-cita-mascota');

    const btnBuscarMascota = document.getElementById('btn-modal-cita-buscar-mascota');
    const inputBuscarMascota = document.getElementById('modal-cita-buscar-mascota-input');
    const btnCambiarMascota = document.getElementById('btn-modal-cita-cambiar-mascota');

    const cerrar = () => modal?.classList.add('hidden');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrar);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrar();
      });
    }

    if (btnCambiarMascota) {
      btnCambiarMascota.addEventListener('click', () => {
        const boxBuscador = document.getElementById('modal-cita-buscador-mascota-box');
        if (boxBuscador) {
          boxBuscador.classList.remove('hidden');
          inputBuscarMascota?.focus();
        }
      });
    }

    if (btnBuscarMascota) {
      btnBuscarMascota.addEventListener('click', () => this.buscarMascotaDentroDeModalCita());
    }
    if (inputBuscarMascota) {
      inputBuscarMascota.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.buscarMascotaDentroDeModalCita();
        }
      });
    }

    if (btnToggleSemana) {
      btnToggleSemana.addEventListener('click', () => {
        this.modalCitaVistaSemana = !this.modalCitaVistaSemana;
        const lbl = document.getElementById('label-modal-cita-toggle-semana');
        if (lbl) {
          lbl.textContent = this.modalCitaVistaSemana
            ? 'Ver Solo Día Seleccionado'
            : 'Ver Semana Completa';
        }
        this.consultarDisponibilidadModalCita();
      });
    }

    const cambiarFechaConBloqueoPasado = (nuevaFecha) => {
      const hoy = this._hoyLocalISO();
      const msgPasado = document.getElementById('modal-cita-bloqueo-pasado-msg');
      if (nuevaFecha < hoy) {
        if (inputFecha) inputFecha.value = hoy;
        if (msgPasado) msgPasado.classList.remove('hidden');
        this.notify('No se pueden agendar citas en fechas pasadas.', 'warning');
      } else {
        if (inputFecha) inputFecha.value = nuevaFecha;
        if (msgPasado) msgPasado.classList.add('hidden');
      }
      this.consultarDisponibilidadModalCita();
    };

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const actual = inputFecha?.value || this._hoyLocalISO();
        const salto = this.modalCitaVistaSemana ? -7 : -1;
        cambiarFechaConBloqueoPasado(this._sumarDiasISO(actual, salto));
      });
    }
    if (btnHoy) {
      btnHoy.addEventListener('click', () => {
        cambiarFechaConBloqueoPasado(this._hoyLocalISO());
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const actual = inputFecha?.value || this._hoyLocalISO();
        const salto = this.modalCitaVistaSemana ? 7 : 1;
        cambiarFechaConBloqueoPasado(this._sumarDiasISO(actual, salto));
      });
    }

    if (btnRecalcular) {
      btnRecalcular.addEventListener('click', () => this.consultarDisponibilidadModalCita());
    }
    if (inputFecha) {
      inputFecha.addEventListener('change', () => {
        cambiarFechaConBloqueoPasado(inputFecha.value || this._hoyLocalISO());
      });
    }
    if (inputDuracion) {
      inputDuracion.addEventListener('change', () => this.consultarDisponibilidadModalCita());
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

  async buscarMascotaDentroDeModalCita() {
    const input = document.getElementById('modal-cita-buscar-mascota-input');
    const cont = document.getElementById('modal-cita-mascota-resultados');
    if (!input || !cont) return;

    const q = input.value.trim();
    if (q.length < 2) {
      cont.innerHTML = `<p class="text-[11px] text-amber-600 font-semibold">Escribe al menos 2 caracteres para buscar.</p>`;
      return;
    }

    try {
      cont.innerHTML = `<p class="text-[11px] text-slate-400">Buscando mascotas...</p>`;
      const data = await this.api.get('/clientes/buscar', { q });
      const clientes = data.resultados || [];
      const items = [];
      clientes.forEach((cli) => {
        (cli.mascotas || []).forEach((m) => {
          items.push({
            id: m.id,
            nombre: m.nombre,
            raza: m.raza || 'Mestiza',
            codigo: m.codigo_barras || '',
            cliente_nombre: cli.nombre,
            cliente_telefono: cli.telefono || '',
          });
        });
      });

      if (!items.length) {
        cont.innerHTML = `<p class="text-[11px] text-rose-600 font-semibold">No se encontraron mascotas con "${q}".</p>`;
        return;
      }

      cont.innerHTML = items
        .map(
          (it) => `
          <button type="button"
            data-pick-pet-id="${it.id}"
            data-pick-pet-nombre="${it.nombre}"
            data-pick-pet-raza="${it.raza}"
            data-pick-cli-nombre="${it.cliente_nombre}"
            class="w-full text-left p-2 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition">
            <div>
              <span class="font-extrabold text-slate-900 text-xs">${it.nombre}</span>
              <span class="text-[11px] text-slate-500">(${it.raza}) · Dueño: ${it.cliente_nombre} (${it.cliente_telefono})</span>
            </div>
            <span class="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold">Seleccionar</span>
          </button>
        `
        )
        .join('');

      cont.querySelectorAll('[data-pick-pet-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-pick-pet-id');
          const pnom = btn.getAttribute('data-pick-pet-nombre');
          const praza = btn.getAttribute('data-pick-pet-raza');
          const cnom = btn.getAttribute('data-pick-cli-nombre');

          const idInput = document.getElementById('modal-cita-mascota-id');
          const labelEl = document.getElementById('modal-cita-mascota-label');
          const boxBuscador = document.getElementById('modal-cita-buscador-mascota-box');
          const btnCambiar = document.getElementById('btn-modal-cita-cambiar-mascota');

          if (idInput) idInput.value = pid;
          if (labelEl) {
            labelEl.textContent = `${pnom} (${praza}) · Dueño: ${cnom}`;
          }
          if (boxBuscador) boxBuscador.classList.add('hidden');
          if (btnCambiar) btnCambiar.classList.remove('hidden');
          cont.innerHTML = '';
          input.value = '';
        });
      });
    } catch (err) {
      cont.innerHTML = `<p class="text-[11px] text-rose-600">Error: ${err.message}</p>`;
    }
  }

  async abrirModalAgendarCitaMascota(mascotaInfo = null, prefill = {}) {
    const modal = document.getElementById('modal-agendar-cita-mascota');
    const idInput = document.getElementById('modal-cita-mascota-id');
    const labelEl = document.getElementById('modal-cita-mascota-label');
    const fechaInput = document.getElementById('modal-cita-fecha');
    const horaInput = document.getElementById('modal-cita-hora-seleccionada');
    const notasInput = document.getElementById('modal-cita-notas');
    const boxBuscador = document.getElementById('modal-cita-buscador-mascota-box');
    const btnCambiar = document.getElementById('btn-modal-cita-cambiar-mascota');
    const msgPasado = document.getElementById('modal-cita-bloqueo-pasado-msg');
    if (!modal || !idInput) return;

    const hoy = this._hoyLocalISO();
    if (fechaInput) {
      fechaInput.min = hoy;
    }
    if (msgPasado) {
      msgPasado.classList.add('hidden');
    }

    if (mascotaInfo && mascotaInfo.id) {
      idInput.value = mascotaInfo.id;
      if (labelEl) {
        labelEl.textContent = `${mascotaInfo.nombre} (${mascotaInfo.raza || 'Mascota'}) · Dueño: ${mascotaInfo.cliente_nombre || ''}`;
      }
      if (boxBuscador) boxBuscador.classList.add('hidden');
      if (btnCambiar) btnCambiar.classList.remove('hidden');
    } else {
      idInput.value = '';
      if (labelEl) {
        labelEl.textContent = 'Ninguna mascota seleccionada aún — búscala arriba para continuar';
      }
      if (boxBuscador) boxBuscador.classList.remove('hidden');
      if (btnCambiar) btnCambiar.classList.add('hidden');
    }

    const fechaInicial =
      prefill.fecha && prefill.fecha >= hoy ? prefill.fecha : fechaInput?.value >= hoy ? fechaInput.value : hoy;
    if (fechaInput) {
      fechaInput.value = fechaInicial;
    }

    this.slotSeleccionadoModalCita = prefill.hora || null;
    if (horaInput) {
      horaInput.value = prefill.hora || '';
    }
    if (notasInput) {
      notasInput.value = '';
    }

    this._actualizarBadgeSeleccionModalCita();
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

    const hoy = this._hoyLocalISO();
    let fecha = fechaInput.value || hoy;
    if (fecha < hoy) {
      fecha = hoy;
      fechaInput.value = hoy;
      document.getElementById('modal-cita-bloqueo-pasado-msg')?.classList.remove('hidden');
    }

    const duracion_minutos = Number(durInput?.value || 60);

    try {
      slotsContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Calculando disponibilidad de horarios...</div>`;

      if (this.modalCitaVistaSemana) {
        const dataSemana = await this.api.get('/disponibilidad/semana', {
          fecha,
          duracion_minutos,
        });
        this._renderSemanaEnModalCita(dataSemana, slotsContainer);
      } else {
        const dataDia = await this.api.get('/disponibilidad', {
          fecha,
          duracion_minutos,
        });
        this._renderDiaEnModalCita(dataDia, slotsContainer);
      }
    } catch (err) {
      slotsContainer.innerHTML = `<div class="p-4 text-red-600 text-xs">Error al consultar disponibilidad: ${err.message}</div>`;
    }
  }

  _renderDiaEnModalCita(dataDia, container) {
    const fecha = dataDia.fecha || '';
    const nombreDia = dataDia.nombre_dia || '';

    if (!dataDia.abierto) {
      container.innerHTML = `
        <div class="p-4 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span><i class="fa-solid fa-ban mr-1.5"></i><strong>${nombreDia} ${fecha}:</strong> Sucursal cerrada (${dataDia.motivo_cierre || 'Día inhábil'})</span>
          <span class="text-[11px] text-rose-600">Usa "Ver Semana Completa" para elegir otro día</span>
        </div>`;
      return;
    }

    const slots = dataDia.slots || [];
    if (!slots.length) {
      container.innerHTML = `<div class="p-4 text-slate-500 text-xs">No hay bloques configurados para este día.</div>`;
      return;
    }

    const rowsHtml = slots
      .map((s) => {
        const isSelected = this.slotSeleccionadoModalCita === s.hora;
        const esPasado = Boolean(s.pasado);
        const disponible = Boolean(s.disponible) && !esPasado;

        let blockClass = '';
        let badgeHtml = '';

        if (isSelected && disponible) {
          blockClass =
            'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300 cursor-pointer';
          badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-white text-blue-700 text-[10px] font-extrabold"><i class="fa-solid fa-check mr-1"></i>Bloque Seleccionado (${s.cupos_disponibles} libre${s.cupos_disponibles === 1 ? '' : 's'})</span>`;
        } else if (disponible) {
          blockClass =
            'bg-teal-50/70 hover:bg-blue-50 text-slate-800 border-teal-300 hover:border-blue-500 cursor-pointer';
          badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold"><i class="fa-solid fa-plus mr-1"></i>Disponible · ${s.cupos_disponibles} de ${s.capacidad_total} cupos libres (Clic para elegir)</span>`;
        } else if (esPasado) {
          blockClass =
            'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-65';
          badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold"><i class="fa-solid fa-lock mr-1"></i>Bloqueado (Horario pasado)</span>`;
        } else if (s.en_horario_comida) {
          blockClass =
            'bg-amber-50/70 text-amber-800 border-amber-200 cursor-not-allowed opacity-75';
          badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold"><i class="fa-solid fa-utensils mr-1"></i>Horario de comida / Sin cupo</span>`;
        } else {
          blockClass =
            'bg-rose-50/60 text-rose-700 border-rose-200 cursor-not-allowed opacity-75';
          badgeHtml = `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold"><i class="fa-solid fa-calendar-xmark mr-1"></i>Ocupado (${s.citas_traslapadas}/${s.capacidad_total} ocupados)</span>`;
        }

        return `
          <div class="flex items-stretch border-b border-slate-100 last:border-b-0">
            <div class="w-24 shrink-0 px-3 py-2.5 bg-slate-50 border-r border-slate-200 flex flex-col justify-center">
              <span class="font-mono font-extrabold text-xs text-slate-800">${s.hora}</span>
              <span class="font-mono text-[10px] text-slate-400">a ${s.hora_fin || ''}</span>
            </div>
            <div class="flex-1 p-1.5">
              <button type="button"
                ${disponible ? '' : 'disabled'}
                data-modal-slot-fecha="${fecha}"
                data-modal-slot-hora="${s.hora}"
                class="w-full h-full rounded-xl border px-3 py-2 text-left flex flex-wrap items-center justify-between gap-2 transition ${blockClass}">
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-xs">${s.hora} - ${s.hora_fin || ''}</span>
                  ${
                    s.en_horario_comida && disponible
                      ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Comida parcial</span>'
                      : ''
                  }
                </div>
                ${badgeHtml}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-extrabold text-slate-700">
        <span><i class="fa-regular fa-calendar mr-1 text-blue-600"></i>${nombreDia} ${fecha} — Disponibilidad del Día</span>
        <span class="text-emerald-700">${(dataDia.horarios_disponibles || []).length} bloques con cupo disponible</span>
      </div>
      <div class="divide-y divide-slate-100">${rowsHtml}</div>
    `;

    this._bindModalSlotClicks(container);
  }

  _renderSemanaEnModalCita(dataSemana, container) {
    const dias = dataSemana.dias || [];
    const horasEje = dataSemana.horas_eje || [];
    const fechaSeleccionada = document.getElementById('modal-cita-fecha')?.value || '';

    if (!dias.length) {
      container.innerHTML = `<div class="p-4 text-slate-500 text-xs">No se pudo construir la semana completa.</div>`;
      return;
    }

    const headersHtml = dias
      .map((d) => {
        const esFechaActiva = d.fecha === fechaSeleccionada;
        const numDia = String(d.fecha || '').slice(8, 10);
        return `
          <th class="p-2 text-center border-l border-slate-200 min-w-[110px] ${
            esFechaActiva ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-700'
          }">
            <div class="text-[10px] uppercase font-extrabold">${d.nombre_dia || ''}</div>
            <div class="text-xs font-black">${numDia} <span class="text-[10px] font-normal text-slate-400">(${String(d.fecha || '').slice(5, 7)})</span></div>
          </th>
        `;
      })
      .join('');

    const bodyRowsHtml = horasEje
      .map((hora) => {
        const cellsHtml = dias
          .map((d) => {
            if (!d.abierto) {
              return `
                <td class="p-1 border-l border-t border-slate-100 bg-slate-100/70 text-center">
                  <span class="text-[10px] text-slate-400 font-semibold">Cerrado</span>
                </td>`;
            }
            const slot = (d.slots || []).find((s) => s.hora === hora);
            if (!slot) {
              return `<td class="p-1 border-l border-t border-slate-100 bg-slate-50"></td>`;
            }

            const esPasado = Boolean(slot.pasado);
            const disp = Boolean(slot.disponible) && !esPasado;
            const isSelected =
              d.fecha === fechaSeleccionada && this.slotSeleccionadoModalCita === hora;

            if (isSelected && disp) {
              return `
                <td class="p-1 border-l border-t border-slate-100">
                  <button type="button"
                    data-modal-slot-fecha="${d.fecha}"
                    data-modal-slot-hora="${hora}"
                    class="w-full rounded-lg bg-blue-600 text-white px-2 py-1.5 text-center shadow-xs ring-2 ring-blue-300 cursor-pointer">
                    <div class="font-extrabold text-[11px]"><i class="fa-solid fa-check mr-0.5"></i>${hora}</div>
                    <div class="text-[9px] text-blue-100">Seleccionado</div>
                  </button>
                </td>`;
            }

            if (disp) {
              return `
                <td class="p-1 border-l border-t border-slate-100">
                  <button type="button"
                    data-modal-slot-fecha="${d.fecha}"
                    data-modal-slot-hora="${hora}"
                    class="w-full rounded-lg bg-teal-50 hover:bg-blue-50 border border-teal-300 hover:border-blue-500 text-teal-900 px-2 py-1.5 text-center transition cursor-pointer">
                    <div class="font-extrabold text-[11px] text-emerald-800">Disponible</div>
                    <div class="text-[9px] font-semibold text-emerald-600">${slot.cupos_disponibles} cupo(s)</div>
                  </button>
                </td>`;
            }

            if (esPasado) {
              return `
                <td class="p-1 border-l border-t border-slate-100 bg-slate-50/80 text-center">
                  <span class="text-[10px] text-slate-400 font-medium"><i class="fa-solid fa-lock mr-0.5"></i>Pasado</span>
                </td>`;
            }

            return `
              <td class="p-1 border-l border-t border-slate-100 bg-rose-50/40 text-center">
                <span class="text-[10px] text-rose-400 font-semibold">Sin cupo</span>
              </td>`;
          })
          .join('');

        return `
          <tr>
            <td class="px-2.5 py-1.5 border-t border-slate-200 bg-slate-50 font-mono font-extrabold text-[11px] text-slate-700 text-center whitespace-nowrap">
              ${hora}
            </td>
            ${cellsHtml}
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-extrabold text-slate-700">
        <span><i class="fa-solid fa-table-columns mr-1 text-blue-600"></i>Semana del ${dataSemana.fecha_inicio_semana} al ${dataSemana.fecha_fin_semana}</span>
        <span class="text-blue-700">Da clic en cualquier bloque "Disponible" para elegir día y hora</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="p-2 bg-slate-100 text-slate-600 font-extrabold text-[10px] uppercase w-16">Hora</th>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${bodyRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    this._bindModalSlotClicks(container);
  }

  _bindModalSlotClicks(container) {
    container.querySelectorAll('[data-modal-slot-hora]:not(:disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-modal-slot-fecha');
        const h = btn.getAttribute('data-modal-slot-hora');
        const fechaInput = document.getElementById('modal-cita-fecha');
        const horaInput = document.getElementById('modal-cita-hora-seleccionada');

        if (f && fechaInput) {
          fechaInput.value = f;
        }
        this.slotSeleccionadoModalCita = h;
        if (horaInput) {
          horaInput.value = h || '';
        }
        this._actualizarBadgeSeleccionModalCita();
        this.consultarDisponibilidadModalCita();
      });
    });
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
      this.notify('Primero busca y selecciona la mascota para la cita.', 'warning');
      document.getElementById('modal-cita-buscador-mascota-box')?.classList.remove('hidden');
      document.getElementById('modal-cita-buscar-mascota-input')?.focus();
      return;
    }
    if (!fecha || !hora) {
      this.notify('Haz clic en un bloque disponible del calendario para elegir horario.', 'warning');
      return;
    }

    const hoy = this._hoyLocalISO();
    if (fecha < hoy) {
      this.notify('No se pueden agendar citas en fechas pasadas.', 'error');
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
      document.getElementById('modal-agendar-cita-mascota')?.classList.add('hidden');

      if (
        this.expedienteActual?.cliente?.id &&
        !document.getElementById('modal-expediente-cliente')?.classList.contains('hidden')
      ) {
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
        await this.cargarPadronGeneral();
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
      await this.cargarPadronGeneral();
      await this.abrirExpedienteCliente(cliente_id, false, nuevaMascotaId);
    } catch (err) {
      this.notify(`Error al registrar mascota: ${err.message}`, 'error');
    }
  }
}
