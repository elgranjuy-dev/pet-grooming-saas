/**
 * InventarioCajaView.js
 * Vista POO para gestión de Inventario, Lector/Escáner inteligente (códigos PET- y productos)
 * y control de Movimientos de Caja por sucursal.
 */
export class InventarioCajaView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
  }

  init() {
    const formProducto = document.getElementById('form-crear-producto');
    if (formProducto) {
      formProducto.addEventListener('submit', (e) => {
        e.preventDefault();
        this.crearProducto();
      });
    }

    const formEscanear = document.getElementById('form-escanear-codigo');
    if (formEscanear) {
      formEscanear.addEventListener('submit', (e) => {
        e.preventDefault();
        this.procesarEscaneo();
      });
    }

    const formCaja = document.getElementById('form-crear-caja');
    if (formCaja) {
      formCaja.addEventListener('submit', (e) => {
        e.preventDefault();
        this.registrarMovimientoCaja();
      });
    }
  }

  async load() {
    await Promise.all([this.cargarInventario(), this.cargarCaja()]);
  }

  async cargarInventario() {
    const tbody = document.getElementById('inventario-tbody');
    if (!tbody) return;

    try {
      const data = await this.api.get('/inventario');
      const productos = data.inventario || [];

      if (!productos.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-slate-400 text-sm">
              No hay productos registrados en el inventario de esta sucursal.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = productos
        .map((p) => {
          const bajoStock = Number(p.stock) <= Number(p.stock_minimo);
          const stockClass = bajoStock
            ? 'bg-red-100 text-red-700 font-bold'
            : 'bg-emerald-100 text-emerald-700 font-semibold';

          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-3 px-3 text-sm font-semibold text-slate-800">${p.nombre}</td>
              <td class="py-3 px-3 text-xs text-slate-600">${p.categoria || 'Insumo'}</td>
              <td class="py-3 px-3">
                <span class="px-2.5 py-0.5 rounded-full text-xs ${stockClass}">
                  ${p.stock} uds (Min: ${p.stock_minimo})
                </span>
              </td>
              <td class="py-3 px-3 text-sm font-semibold text-slate-800">$${Number(
                p.precio_venta || 0
              ).toFixed(2)}</td>
              <td class="py-3 px-3 text-right">
                <button type="button"
                  data-prod-nombre="${p.nombre}"
                  class="btn-usar-escaner text-xs text-blue-600 hover:text-blue-800 font-semibold">
                  <i class="fa-solid fa-barcode mr-1"></i>Enviar a Escáner
                </button>
              </td>
            </tr>`;
        })
        .join('');

      tbody.querySelectorAll('.btn-usar-escaner').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nombre = btn.getAttribute('data-prod-nombre');
          const input = document.getElementById('escaner-codigo-input');
          if (input) {
            input.value = nombre;
            input.focus();
          }
        });
      });
    } catch (err) {
      this.notify(`Error al cargar inventario: ${err.message}`, 'error');
    }
  }

  async crearProducto() {
    const nombre = document.getElementById('prod-nombre')?.value.trim();
    const categoria = document.getElementById('prod-categoria')?.value || 'Insumo';
    const stock = Number(document.getElementById('prod-stock')?.value || 0);
    const stock_minimo = Number(document.getElementById('prod-stock-min')?.value || 5);
    const precio_venta = Number(document.getElementById('prod-precio')?.value || 0);

    if (!nombre) {
      this.notify('El nombre del producto es obligatorio.', 'warning');
      return;
    }

    try {
      await this.api.post('/inventario', {
        nombre,
        categoria,
        stock,
        stock_minimo,
        precio_venta,
      });
      this.notify('Producto registrado en el inventario.', 'success');
      document.getElementById('form-crear-producto')?.reset();
      await this.cargarInventario();
    } catch (err) {
      this.notify(`Error al guardar producto: ${err.message}`, 'error');
    }
  }

  async procesarEscaneo() {
    const codigo = document.getElementById('escaner-codigo-input')?.value.trim();
    const accion = document.getElementById('escaner-accion')?.value || 'consulta';
    const cantidad = Number(document.getElementById('escaner-cantidad')?.value || 1);
    const metodo_pago =
      document.getElementById('escaner-metodo-pago')?.value || 'Efectivo';
    const resultBox = document.getElementById('escaner-resultado-box');

    if (!codigo) {
      this.notify('Ingresa o escanea un código primero.', 'warning');
      return;
    }

    try {
      const res = await this.api.post('/escanear', {
        codigo,
        accion,
        cantidad,
        metodo_pago,
      });

      if (resultBox) {
        resultBox.classList.remove('hidden');
        if (res.tipo === 'mascota') {
          const m = res.mascota || {};
          const c = res.cliente || {};
          const visitas = Number(m.visitas_acumuladas || 0);
          const meta = Number(m.meta_lealtad || 5);
          resultBox.innerHTML = `
            <div class="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-extrabold text-blue-900 text-sm">
                  <i class="fa-solid fa-dog mr-1"></i>Tarjeta de Lealtad Identificada: ${m.nombre} (${m.raza})
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[11px]">
                  Lealtad: ${visitas} / ${meta} visitas
                </span>
              </div>
              <p class="text-slate-700">
                <strong>Dueño:</strong> ${c.nombre || '-'} (${c.telefono || '-'}) ·
                <strong>Temperamento:</strong> ${m.temperamento || 'Dócil'} ·
                <strong class="text-red-700">Alergias:</strong> ${m.alergias_medicas || 'Ninguna'}
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div class="p-2 rounded-lg bg-white border border-blue-100">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block"># de Navaja</span>
                  <span class="font-bold text-slate-800">${m.numero_navaja || 'Sin especificar'}</span>
                </div>
                <div class="p-2 rounded-lg bg-white border border-blue-100">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Shampoo Asignado</span>
                  <span class="font-bold text-slate-800">${m.tipo_shampoo || 'Sin especificar'}</span>
                </div>
                <div class="p-2 rounded-lg bg-white border border-blue-100">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Estilo de Corte</span>
                  <span class="font-bold text-slate-800">${m.estilo_corte || 'Sin especificar'}</span>
                </div>
              </div>
            </div>`;
        } else {
          const p = res.producto || {};
          resultBox.innerHTML = `
            <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div class="font-bold text-emerald-900 text-sm">${res.mensaje}</div>
              <p class="text-slate-700"><strong>Producto:</strong> ${p.nombre} · <strong>Stock actual:</strong> ${p.stock} uds · <strong>Precio:</strong> $${Number(p.precio_venta || 0).toFixed(2)}</p>
            </div>`;
        }
      }

      this.notify(res.mensaje || 'Escaneo procesado.', 'success');
      await Promise.all([this.cargarInventario(), this.cargarCaja()]);
    } catch (err) {
      this.notify(`Escáner: ${err.message}`, 'error');
    }
  }

  async cargarCaja() {
    const tbody = document.getElementById('caja-tbody');
    const totalEl = document.getElementById('caja-total-ingresos');
    if (!tbody) return;

    try {
      const data = await this.api.get('/caja');
      const movimientos = data.movimientos || [];
      if (totalEl) {
        totalEl.textContent = `$${Number(data.total_ingresos || 0).toFixed(2)} MXN`;
      }

      if (!movimientos.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-slate-400 text-sm">
              No hay movimientos de caja registrados en esta sucursal.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = movimientos
        .map((m) => {
          const fechaStr = m.fecha
            ? new Date(m.fecha).toLocaleString('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : '-';
          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2.5 px-3 text-xs text-slate-500">${fechaStr}</td>
              <td class="py-2.5 px-3 text-sm font-semibold text-slate-800">${m.concepto}</td>
              <td class="py-2.5 px-3 text-xs text-slate-600">${m.metodo_pago}</td>
              <td class="py-2.5 px-3 text-xs text-slate-600">${m.estilista || 'General'}</td>
              <td class="py-2.5 px-3 text-sm font-bold text-emerald-700 text-right">$${Number(
                m.monto || 0
              ).toFixed(2)}</td>
            </tr>`;
        })
        .join('');
    } catch (err) {
      this.notify(`Error al cargar caja: ${err.message}`, 'error');
    }
  }

  async registrarMovimientoCaja() {
    const concepto = document.getElementById('caja-concepto')?.value.trim();
    const monto = Number(document.getElementById('caja-monto')?.value || 0);
    const metodo_pago =
      document.getElementById('caja-metodo-pago')?.value || 'Efectivo';
    const estilista =
      document.getElementById('caja-estilista')?.value.trim() || 'General';

    if (!concepto || monto <= 0) {
      this.notify('Ingresa un concepto válido y un monto mayor a 0.', 'warning');
      return;
    }

    try {
      await this.api.post('/caja', {
        concepto,
        monto,
        metodo_pago,
        estilista,
      });
      this.notify('Ingreso registrado en caja.', 'success');
      document.getElementById('form-crear-caja')?.reset();
      await this.cargarCaja();
    } catch (err) {
      this.notify(`Error al registrar en caja: ${err.message}`, 'error');
    }
  }
}
