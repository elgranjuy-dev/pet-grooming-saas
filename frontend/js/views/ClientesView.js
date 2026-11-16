/**
 * ClientesView.js
 * Vista POO para búsqueda privada exacta de clientes/mascotas (sin exponer padrón completo),
 * registro de nuevos clientes y alta de mascotas con código de lealtad PET- generado en backend.
 */
export class ClientesView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.clientesEncontrados = [];
  }

  init() {
    const formBuscar = document.getElementById('form-buscar-clientes');
    if (formBuscar) {
      formBuscar.addEventListener('submit', (e) => {
        e.preventDefault();
        this.buscarClientes();
      });
    }

    const formCliente = document.getElementById('form-crear-cliente');
    if (formCliente) {
      formCliente.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearCliente();
      });
    }

    const formMascota = document.getElementById('form-crear-mascota');
    if (formMascota) {
      formMascota.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearMascota();
      });
    }
  }

  async load() {
    // Por privacidad la vista inicia sin exponer el padrón completo
  }

  async buscarClientes(terminoExplicito = null) {
    const input = document.getElementById('clientes-buscar-input');
    const q = (terminoExplicito !== null ? terminoExplicito : input?.value || '').trim();
    const container = document.getElementById('clientes-resultados-container');
    if (!container) return;

    if (q.length < 2) {
      this.notify('Ingresa al menos 2 caracteres para buscar en el padrón privado.', 'warning');
      return;
    }

    try {
      const data = await this.api.get('/clientes/buscar', { q });
      this.clientesEncontrados = data.resultados || [];
      this.renderResultados(this.clientesEncontrados);
    } catch (err) {
      this.notify(`Error en búsqueda de clientes: ${err.message}`, 'error');
    }
  }

  renderResultados(clientes) {
    const container = document.getElementById('clientes-resultados-container');
    if (!container) return;

    if (!clientes.length) {
      container.innerHTML = `
        <div class="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
          <i class="fa-solid fa-magnifying-glass text-slate-400 text-xl mb-2 block"></i>
          No se encontraron coincidencias para tu búsqueda.
        </div>`;
      return;
    }

    container.innerHTML = clientes
      .map((c) => {
        const mascotasHtml = (c.mascotas || []).length
          ? c.mascotas
              .map(
                (m) => `
                <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-slate-800"><i class="fa-solid fa-paw text-blue-600 mr-1"></i>${m.nombre}</span>
                      <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">${m.raza}</span>
                      <span class="text-xs text-slate-500">${m.peso_kg || 0} kg</span>
                    </div>
                    <p class="text-xs text-slate-600 mt-1">
                      <strong>Alergias:</strong> ${m.alergias_medicas || 'Ninguna'} ·
                      <strong>Temperamento:</strong> ${m.temperamento || 'Dócil'} ·
                      <strong>Navaja/Corte:</strong> ${m.numero_navaja || '-'} / ${m.estilo_corte || '-'}
                    </p>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-emerald-400 tracking-wider">
                      <i class="fa-solid fa-barcode mr-1"></i>${m.codigo_barras || 'SIN-CODIGO'}
                    </span>
                  </div>
                </div>`
              )
              .join('')
          : `<p class="text-xs text-slate-400 italic">Sin mascotas registradas aún.</p>`;

        return `
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 class="font-bold text-slate-900 text-base">${c.nombre}</h4>
                <p class="text-xs text-slate-500">
                  <i class="fa-solid fa-phone mr-1"></i>${c.telefono}
                  ${c.email ? ` · <i class="fa-solid fa-envelope ml-2 mr-1"></i>${c.email}` : ''}
                </p>
              </div>
              <button type="button"
                data-cliente-id="${c.id}"
                data-cliente-nombre="${c.nombre}"
                class="btn-asignar-dueno px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition">
                <i class="fa-solid fa-plus mr-1"></i>Agregar Mascota a este Cliente
              </button>
            </div>
            <div class="space-y-2">
              ${mascotasHtml}
            </div>
          </div>`;
      })
      .join('');

    container.querySelectorAll('.btn-asignar-dueno').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cliente-id');
        const nombre = btn.getAttribute('data-cliente-nombre');
        this.seleccionarClienteParaMascota(id, nombre);
      });
    });
  }

  seleccionarClienteParaMascota(clienteId, clienteNombre) {
    const inputId = document.getElementById('mascota-cliente-id');
    const label = document.getElementById('mascota-cliente-nombre-badge');
    if (inputId) inputId.value = clienteId;
    if (label) {
      label.textContent = `Dueño seleccionado: ${clienteNombre}`;
      label.classList.remove('hidden');
    }
    document.getElementById('mascota-nombre')?.focus();
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
      this.notify(`Cliente ${nuevo.nombre} creado exitosamente.`, 'success');
      document.getElementById('form-crear-cliente')?.reset();

      if (nuevo?.id) {
        this.seleccionarClienteParaMascota(nuevo.id, nuevo.nombre);
        await this.buscarClientes(nuevo.telefono);
      }
    } catch (err) {
      this.notify(`Error al registrar cliente: ${err.message}`, 'error');
    }
  }

  async crearMascota() {
    const cliente_id = document.getElementById('mascota-cliente-id')?.value.trim();
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
      this.notify('Selecciona o registra primero al cliente dueño de la mascota.', 'warning');
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
        `Mascota registrada con código de lealtad: ${res.codigo_barras}`,
        'success'
      );
      document.getElementById('form-crear-mascota')?.reset();
      document.getElementById('mascota-cliente-id').value = cliente_id;
      await this.buscarClientes(res.codigo_barras || nombre);
    } catch (err) {
      this.notify(`Error al registrar mascota: ${err.message}`, 'error');
    }
  }
}
