/**
 * SuperAdminApp.js
 * Controlador POO para la Consola Maestra de furgo.mx (/superadmin.html).
 * Permite:
 * - Login Maestro Super Admin
 * - Visualización de MRR/ARR y métricas globales
 * - Onboarding 1-Click de nuevos clientes furgo.mx (Organización + Sucursal + Usuario PIN + Agenda)
 * - Gestión de planes, cuotas, expansión de sucursales y Kill-Switch (Activa/Suspendida)
 */
import { ApiClient } from './core/ApiClient.js';

export class SuperAdminApp {
  static STORAGE_KEY = 'furgo_superadmin_session_v1';

  static PLAN_LIMITS = {
    'Básico': { max_sucursales: 1, max_usuarios: 5, max_clientes: 500 },
    'Pro': { max_sucursales: 5, max_usuarios: 25, max_clientes: 5000 },
    'Enterprise': { max_sucursales: 20, max_usuarios: 100, max_clientes: 50000 },
  };

  constructor() {
    this.api = new ApiClient();
    this.organizaciones = [];
    this.chartMrr = null;
    this.selectedOrgId = null;
  }

  init() {
    this.bindEvents();
    if (this.isAuthenticated()) {
      this.mostrarConsola();
    } else {
      this.mostrarLogin();
    }
  }

  isAuthenticated() {
    return Boolean(sessionStorage.getItem(SuperAdminApp.STORAGE_KEY));
  }

  notify(message, type = 'info') {
    const container = document.getElementById('sa-toast-container');
    if (!container) return;

    const palette = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-indigo-600 text-white',
    };

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 ${
      palette[type] || palette.info
    }`;
    toast.innerHTML = `<i class="fa-solid fa-crown"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
  }

  bindEvents() {
    // Login Maestro
    document.getElementById('form-sa-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.ejecutarLogin();
    });

    // Logout
    document.getElementById('btn-sa-logout')?.addEventListener('click', () => {
      sessionStorage.removeItem(SuperAdminApp.STORAGE_KEY);
      this.mostrarLogin();
    });

    // Colapsar barra lateral
    document.getElementById('btn-sa-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('collapsed');
    });

    // Navegación de pestañas
    document.querySelectorAll('[data-sa-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-sa-tab');
        if (target) this.switchTab(target);
      });
    });

    document.getElementById('btn-sa-ir-onboarding')?.addEventListener('click', () => {
      this.switchTab('onboarding');
    });

    document.getElementById('btn-sa-refresh')?.addEventListener('click', () => {
      this.cargarDashboard();
    });

    // Auto-ajustar límites al cambiar Plan en Onboarding
    document.getElementById('ob-plan')?.addEventListener('change', (e) => {
      const lim = SuperAdminApp.PLAN_LIMITS[e.target.value];
      if (lim) {
        document.getElementById('ob-max-suc').value = lim.max_sucursales;
        document.getElementById('ob-max-usr').value = lim.max_usuarios;
        document.getElementById('ob-max-cli').value = lim.max_clientes;
      }
    });

    // Auto-ajustar límites al cambiar Plan en Edición
    document.getElementById('edit-org-plan')?.addEventListener('change', (e) => {
      const lim = SuperAdminApp.PLAN_LIMITS[e.target.value];
      if (lim) {
        document.getElementById('edit-org-max-suc').value = lim.max_sucursales;
        document.getElementById('edit-org-max-usr').value = lim.max_usuarios;
        document.getElementById('edit-org-max-cli').value = lim.max_clientes;
      }
    });

    // Onboarding 1-Click submit
    document.getElementById('form-sa-onboarding')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.ejecutarOnboarding();
    });

    // Selector de organización en pestaña Gestión
    document.getElementById('tenant-manage-select')?.addEventListener('change', (e) => {
      this.seleccionarOrganizacionParaEdicion(e.target.value);
    });

    // Guardar edición de suscripción
    document.getElementById('form-sa-editar-tenant')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.guardarEdicionTenant();
    });

    // Agregar nueva sucursal a tenant
    document.getElementById('form-sa-nueva-sucursal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.agregarSucursalTenant();
    });
  }

  async ejecutarLogin() {
    const email = document.getElementById('sa-login-email')?.value.trim();
    const password = document.getElementById('sa-login-password')?.value.trim();

    try {
      const res = await this.api.post('/superadmin/login', { email, password });
      sessionStorage.setItem(SuperAdminApp.STORAGE_KEY, JSON.stringify(res));
      this.notify(res.mensaje || 'Acceso Super Admin concedido', 'success');
      await this.mostrarConsola();
    } catch (err) {
      this.notify(err.message || 'Credenciales incorrectas', 'error');
    }
  }

  mostrarLogin() {
    document.getElementById('sa-login-screen')?.classList.remove('hidden');
    document.getElementById('sa-app-shell')?.classList.add('hidden');
  }

  async mostrarConsola() {
    document.getElementById('sa-login-screen')?.classList.add('hidden');
    document.getElementById('sa-app-shell')?.classList.remove('hidden');
    await this.cargarDashboard();
  }

  switchTab(tabName) {
    document.querySelectorAll('[data-sa-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-sa-tab') === tabName);
    });

    document.querySelectorAll('.sa-tab-view').forEach((sec) => {
      sec.classList.toggle('hidden', sec.id !== `sa-view-${tabName}`);
    });
  }

  formatCurrency(val) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(val || 0));
  }

  async cargarDashboard() {
    try {
      const data = await this.api.get('/superadmin/dashboard');
      this.organizaciones = data.organizaciones || [];

      this.renderKpis(data.kpis || {});
      this.renderChartMrr(data.graficas?.mrr_por_plan || {});
      this.renderOrgsTable(this.organizaciones);
      this.poblarSelectorEdicion(this.organizaciones);
      this.renderAuditoria(data.bitacora_global || []);
    } catch (err) {
      this.notify(`Error al cargar datos globales: ${err.message}`, 'error');
    }
  }

  renderKpis(kpis) {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('sa-kpi-mrr', this.formatCurrency(kpis.mrr_estimado));
    setText('sa-kpi-arr', `ARR Anual: ${this.formatCurrency(kpis.arr_estimado)}`);
    setText('sa-kpi-orgs-total', String(kpis.total_organizaciones ?? 0));
    setText(
      'sa-kpi-orgs-detalle',
      `${kpis.organizaciones_activas ?? 0} activas · ${kpis.organizaciones_suspendidas ?? 0} suspendidas`
    );
    setText('sa-kpi-sucursales', `${kpis.total_sucursales ?? 0} sucursales`);
    setText('sa-kpi-usuarios', `${kpis.total_usuarios ?? 0} colaboradores activos`);
    setText('sa-kpi-mascotas', `${kpis.total_mascotas ?? 0} mascotas`);
    setText(
      'sa-kpi-citas',
      `${kpis.total_clientes ?? 0} clientes · ${kpis.total_citas ?? 0} citas`
    );
  }

  renderChartMrr(mrrPorPlan) {
    if (typeof window.Chart === 'undefined') return;
    const ctx = document.getElementById('sa-chart-mrr-plan');
    if (!ctx) return;

    if (this.chartMrr) this.chartMrr.destroy();

    const labels = Object.keys(mrrPorPlan);
    const values = Object.values(mrrPorPlan);

    this.chartMrr = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'MRR ($ MXN)',
            data: values,
            backgroundColor: ['#6366f1', '#2563eb', '#9333ea'],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  renderOrgsTable(orgs) {
    const tbody = document.getElementById('sa-orgs-tbody');
    if (!tbody) return;

    if (!orgs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 text-xs">No hay organizaciones registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = orgs
      .map((o) => {
        const u = o.uso || {};
        const esActiva = String(o.estado || 'Activa').toLowerCase() === 'activa';
        const badgeEstado = esActiva
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-red-100 text-red-700';

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
            <td class="py-2.5 px-2">
              <div class="font-bold text-slate-900">${o.nombre}</div>
              <div class="text-[11px] text-slate-500">${o.email_propietario || 'Sin correo asignado'}</div>
            </td>
            <td class="py-2.5 px-2">
              <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px]">${o.plan}</span>
              <div class="text-[11px] text-slate-500 mt-0.5">$${o.precio_mensual}/mes</div>
            </td>
            <td class="py-2.5 px-2 text-[11px] text-slate-600">
              <div><strong>Suc:</strong> ${u.sucursales_usadas}/${u.max_sucursales}</div>
              <div><strong>Usr:</strong> ${u.usuarios_usados}/${u.max_usuarios} · <strong>Cli:</strong> ${u.clientes_usados}/${u.max_clientes}</div>
            </td>
            <td class="py-2.5 px-2">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeEstado}">
                ${o.estado || 'Activa'}
              </span>
            </td>
            <td class="py-2.5 px-2 text-right space-x-1 whitespace-nowrap">
              <button type="button" data-manage-org="${o.id}"
                class="btn-sa-manage px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]">
                <i class="fa-solid fa-pen-to-square mr-1"></i>Gestionar
              </button>
              <button type="button" data-toggle-org="${o.id}"
                class="btn-sa-toggle px-2.5 py-1 rounded-lg ${
                  esActiva
                    ? 'bg-red-50 hover:bg-red-100 text-red-700'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                } font-bold text-[11px]">
                <i class="fa-solid ${esActiva ? 'fa-ban' : 'fa-circle-check'} mr-1"></i>${
                  esActiva ? 'Suspender' : 'Activar'
                }
              </button>
            </td>
          </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.btn-sa-toggle').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const orgId = btn.getAttribute('data-toggle-org');
        await this.toggleEstadoOrganizacion(orgId);
      });
    });

    tbody.querySelectorAll('.btn-sa-manage').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orgId = btn.getAttribute('data-manage-org');
        this.seleccionarOrganizacionParaEdicion(orgId);
        this.switchTab('tenants');
      });
    });
  }

  async toggleEstadoOrganizacion(orgId) {
    try {
      const res = await this.api.post(`/superadmin/organizaciones/${orgId}/toggle-estado`);
      this.notify(res.mensaje, 'info');
      await this.cargarDashboard();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  async ejecutarOnboarding() {
    const payload = {
      nombre: document.getElementById('ob-nombre')?.value.trim(),
      plan: document.getElementById('ob-plan')?.value || 'Pro',
      max_sucursales: Number(document.getElementById('ob-max-suc')?.value || 5),
      max_usuarios: Number(document.getElementById('ob-max-usr')?.value || 25),
      max_clientes: Number(document.getElementById('ob-max-cli')?.value || 5000),
      email_propietario: document.getElementById('ob-email')?.value.trim(),
      password_propietario: document.getElementById('ob-password')?.value.trim() || 'admin1234',
      nombre_sucursal_inicial:
        document.getElementById('ob-sucursal-nombre')?.value.trim() || 'Sucursal Matriz',
      direccion_sucursal: document.getElementById('ob-sucursal-dir')?.value.trim() || '',
      telefono_sucursal: document.getElementById('ob-sucursal-tel')?.value.trim() || '',
      nombre_dueno_inicial:
        document.getElementById('ob-dueno-nombre')?.value.trim() || 'Administrador Principal',
      pin_dueno_inicial: document.getElementById('ob-dueno-pin')?.value.trim() || '1234',
    };

    try {
      const res = await this.api.post('/superadmin/organizaciones', payload);
      const cred = res.credenciales_entrega || {};
      const box = document.getElementById('ob-credenciales-box');
      if (box) {
        box.innerHTML = `
          <div class="text-emerald-400 font-bold mb-1">✓ CLIENTE APROVISIONADO</div>
          <div><span class="text-slate-400">Empresa:</span> ${cred.organizacion_nombre} (${cred.plan})</div>
          ${cred.portal_url ? `<div><span class="text-slate-400">Portal:</span> <span class="text-indigo-300">${cred.portal_url}</span></div>` : ''}
          <div><span class="text-slate-400">Correo furgo.mx:</span> ${cred.email_propietario}</div>
          <div><span class="text-slate-400">Contraseña:</span> ${cred.password_propietario}</div>
          <div><span class="text-slate-400">Sucursal:</span> ${cred.sucursal_inicial}</div>
          <div><span class="text-slate-400">Usuario Dueño:</span> ${cred.usuario_dueno}</div>
          <div><span class="text-slate-400">PIN Operativo:</span> <span class="text-amber-300 font-bold">${cred.pin_dueno}</span></div>
        `;
      }
      this.notify(res.mensaje, 'success');
      document.getElementById('form-sa-onboarding')?.reset();
      await this.cargarDashboard();
    } catch (err) {
      this.notify(`Error en Onboarding: ${err.message}`, 'error');
    }
  }

  poblarSelectorEdicion(orgs) {
    const select = document.getElementById('tenant-manage-select');
    if (!select) return;

    select.innerHTML = orgs
      .map((o) => `<option value="${o.id}">${o.nombre} (${o.plan} — ${o.estado})</option>`)
      .join('');

    if (orgs.length) {
      const targetId =
        this.selectedOrgId && orgs.some((o) => o.id === this.selectedOrgId)
          ? this.selectedOrgId
          : orgs[0].id;
      select.value = targetId;
      this.seleccionarOrganizacionParaEdicion(targetId);
    }
  }

  seleccionarOrganizacionParaEdicion(orgId) {
    this.selectedOrgId = orgId;
    const select = document.getElementById('tenant-manage-select');
    if (select && select.value !== orgId) select.value = orgId;

    const org = this.organizaciones.find((o) => o.id === orgId);
    if (!org) return;

    document.getElementById('edit-org-nombre').value = org.nombre || '';
    document.getElementById('edit-org-estado').value = org.estado || 'Activa';
    document.getElementById('edit-org-plan').value = org.plan || 'Pro';
    document.getElementById('edit-org-max-suc').value = org.max_sucursales ?? 5;
    document.getElementById('edit-org-max-usr').value = org.max_usuarios ?? 25;
    document.getElementById('edit-org-max-cli').value = org.max_clientes ?? 5000;
    document.getElementById('edit-org-email').value = org.email_propietario || '';
    document.getElementById('edit-org-password').value = '';

    const sucsContainer = document.getElementById('tenant-sucursales-lista');
    if (sucsContainer) {
      const sucs = org.sucursales || [];
      sucsContainer.innerHTML = sucs.length
        ? sucs
            .map(
              (s) => `
              <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span class="font-bold text-slate-800">${s.nombre}</span>
                  <span class="text-slate-500 ml-1">${s.direccion || ''}</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                  ${s.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>`
            )
            .join('')
        : `<p class="text-xs text-slate-400">Sin sucursales registradas.</p>`;
    }
  }

  async guardarEdicionTenant() {
    if (!this.selectedOrgId) return;

    const payload = {
      nombre: document.getElementById('edit-org-nombre')?.value.trim(),
      estado: document.getElementById('edit-org-estado')?.value,
      plan: document.getElementById('edit-org-plan')?.value,
      max_sucursales: Number(document.getElementById('edit-org-max-suc')?.value || 1),
      max_usuarios: Number(document.getElementById('edit-org-max-usr')?.value || 5),
      max_clientes: Number(document.getElementById('edit-org-max-cli')?.value || 500),
      email_propietario: document.getElementById('edit-org-email')?.value.trim(),
    };
    const pwd = document.getElementById('edit-org-password')?.value.trim();
    if (pwd) payload.password_propietario = pwd;

    try {
      const res = await this.api.put(
        `/superadmin/organizaciones/${this.selectedOrgId}`,
        payload
      );
      this.notify(res.mensaje, 'success');
      await this.cargarDashboard();
    } catch (err) {
      this.notify(`Error al actualizar organización: ${err.message}`, 'error');
    }
  }

  async agregarSucursalTenant() {
    if (!this.selectedOrgId) return;

    const payload = {
      nombre: document.getElementById('add-suc-nombre')?.value.trim(),
      direccion: document.getElementById('add-suc-dir')?.value.trim(),
      telefono: document.getElementById('add-suc-tel')?.value.trim(),
      nombre_encargado:
        document.getElementById('add-suc-encargado')?.value.trim() || 'Encargado',
      pin_encargado: document.getElementById('add-suc-pin')?.value.trim() || '1234',
    };

    try {
      const res = await this.api.post(
        `/superadmin/organizaciones/${this.selectedOrgId}/sucursales`,
        payload
      );
      this.notify(res.mensaje, 'success');
      document.getElementById('form-sa-nueva-sucursal')?.reset();
      await this.cargarDashboard();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  renderAuditoria(eventos) {
    const tbody = document.getElementById('sa-auditoria-tbody');
    if (!tbody) return;

    if (!eventos.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 text-xs">Sin eventos en bitácora global.</td></tr>`;
      return;
    }

    tbody.innerHTML = eventos
      .map((ev) => {
        const fechaFmt = ev.fecha
          ? new Date(ev.fecha).toLocaleString('es-MX', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '-';
        return `
          <tr class="border-b border-slate-100 text-xs">
            <td class="py-2 px-3 text-slate-500 whitespace-nowrap">${fechaFmt}</td>
            <td class="py-2 px-3 font-semibold text-slate-800">${ev.usuario_nombre} (${ev.rol})</td>
            <td class="py-2 px-3">
              <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px]">${ev.accion}</span>
            </td>
            <td class="py-2 px-3 text-slate-600">${ev.detalle || '-'}</td>
          </tr>`;
      })
      .join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SuperAdminApp();
  window.superAdminApp = app;
  app.init();
});
