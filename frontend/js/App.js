/**
 * App.js
 * Controlador principal POO del Frontend Operativo.
 * Inicializa ApiClient, SessionManager y las vistas modulares, gestionando
 * el flujo de login por PIN, navegación entre pestañas, barra lateral colapsable y Check-Out.
 */
import { ApiClient } from './core/ApiClient.js';
import { SessionManager } from './core/SessionManager.js';
import { DashboardView } from './views/DashboardView.js';
import { AgendaView } from './views/AgendaView.js';
import { ClientesView } from './views/ClientesView.js';
import { InventarioCajaView } from './views/InventarioCajaView.js';
import { ConfigPersonalView } from './views/ConfigPersonalView.js';

export class App {
  constructor() {
    this.api = new ApiClient();
    this.session = new SessionManager(this.api);
    this.api.setSessionManager(this.session);

    const notifyBound = this.notify.bind(this);
    this.views = {
      dashboard: new DashboardView(this.api, notifyBound),
      agenda: new AgendaView(this.api, notifyBound),
      clientes: new ClientesView(this.api, notifyBound),
      inventario: new InventarioCajaView(this.api, notifyBound),
      caja: null, // Comparte controlador con InventarioCajaView
      config: new ConfigPersonalView(this.api, notifyBound),
    };
    this.views.caja = this.views.inventario;
    this.activeTab = 'dashboard';
  }

  async init() {
    // Inicializar listeners de vistas
    this.views.dashboard.init();
    this.views.agenda.init();
    this.views.clientes.init();
    this.views.inventario.init();
    this.views.config.init();

    this.bindLoginEvents();
    this.bindNavigationEvents();
    this.bindSidebarAndCheckoutEvents();

    if (this.session.isAuthenticated()) {
      this.mostrarPanelOperativo();
    } else {
      await this.mostrarPantallaLogin();
    }
  }

  notify(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const palette = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-slate-800 text-white',
    };

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition transform duration-200 ${
      palette[type] || palette.info
    }`;
    toast.innerHTML = `<i class="fa-solid fa-bell"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3800);
  }

  bindLoginEvents() {
    const orgSelect = document.getElementById('login-org-select');
    const sucSelect = document.getElementById('login-sucursal-select');
    const formLogin = document.getElementById('form-login-pin');

    if (orgSelect) {
      orgSelect.addEventListener('change', async (e) => {
        await this.poblarSucursalesLogin(e.target.value);
      });
    }

    if (sucSelect) {
      sucSelect.addEventListener('change', async (e) => {
        const orgId = orgSelect?.value || '';
        await this.poblarUsuariosLogin(e.target.value, orgId);
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.ejecutarLoginPin();
      });
    }
  }

  async mostrarPantallaLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-shell')?.classList.add('hidden');

    const orgSelect = document.getElementById('login-org-select');
    try {
      await this.session.cargarContextoInicial();
      const orgs = this.session.organizaciones || [];

      if (orgSelect) {
        if (!orgs.length) {
          orgSelect.innerHTML = `<option value="">Sin organizaciones activas</option>`;
          return;
        }
        orgSelect.innerHTML = orgs
          .map((o) => `<option value="${o.id}">${o.nombre} (Plan ${o.plan || 'Pro'})</option>`)
          .join('');
        await this.poblarSucursalesLogin(orgs[0].id);
      }
    } catch (err) {
      this.notify(`No se pudo conectar con la API: ${err.message}`, 'error');
    }
  }

  async poblarSucursalesLogin(organizacionId) {
    const sucSelect = document.getElementById('login-sucursal-select');
    if (!sucSelect) return;

    const sucursales = this.session.obtenerSucursalesPorOrganizacion(organizacionId);
    if (!sucursales.length) {
      sucSelect.innerHTML = `<option value="">Sin sucursales activas</option>`;
      return;
    }

    sucSelect.innerHTML = sucursales
      .map((s) => `<option value="${s.id}">${s.nombre}</option>`)
      .join('');
    await this.poblarUsuariosLogin(sucursales[0].id, organizacionId);
  }

  async poblarUsuariosLogin(sucursalId, organizacionId) {
    const userSelect = document.getElementById('login-usuario-select');
    if (!userSelect) return;

    try {
      const usuarios = await this.session.cargarUsuariosSucursal(
        sucursalId,
        organizacionId
      );
      if (!usuarios.length) {
        userSelect.innerHTML = `<option value="">Sin personal activo en esta sucursal</option>`;
        return;
      }
      userSelect.innerHTML = usuarios
        .map((u) => `<option value="${u.id}">${u.nombre} — ${u.rol}</option>`)
        .join('');
    } catch (err) {
      this.notify(`Error al cargar usuarios: ${err.message}`, 'error');
    }
  }

  async ejecutarLoginPin() {
    const organizacionId = document.getElementById('login-org-select')?.value;
    const sucursalId = document.getElementById('login-sucursal-select')?.value;
    const usuarioId = document.getElementById('login-usuario-select')?.value;
    const pin = document.getElementById('login-pin-input')?.value.trim();

    if (!organizacionId || !sucursalId || !usuarioId || !pin) {
      this.notify('Completa todos los campos e ingresa tu PIN.', 'warning');
      return;
    }

    try {
      const sesion = await this.session.iniciarSesionPin({
        organizacionId,
        sucursalId,
        usuarioId,
        pin,
      });
      document.getElementById('login-pin-input').value = '';
      this.notify(`Turno iniciado: ${sesion.usuario_nombre} (${sesion.rol})`, 'success');
      this.mostrarPanelOperativo();
    } catch (err) {
      this.notify(err.message || 'PIN inválido', 'error');
    }
  }

  mostrarPanelOperativo() {
    const s = this.session.getSession();
    if (!s) return;

    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');

    // Poblar datos del turno activo en barra lateral y encabezado
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('sidebar-org-nombre', s.organizacion_nombre);
    setText('sidebar-sucursal-nombre', s.sucursal_nombre);
    setText('sidebar-usuario-nombre', s.usuario_nombre);
    setText('sidebar-usuario-rol', s.rol);
    setText(
      'sidebar-hora-entrada',
      s.hora_entrada
        ? new Date(s.hora_entrada).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '--:--'
    );

    const allowedTabs = this.session.aplicarPermisosVisuales();
    const initialTab = allowedTabs.includes('dashboard')
      ? 'dashboard'
      : allowedTabs[0] || 'agenda';
    this.switchTab(initialTab);
  }

  bindNavigationEvents() {
    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab-target');
        if (target) this.switchTab(target);
      });
    });
  }

  async switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('[data-tab-target]').forEach((btn) => {
      const isTarget = btn.getAttribute('data-tab-target') === tabName;
      btn.classList.toggle('active', isTarget);
    });

    document.querySelectorAll('.tab-view').forEach((section) => {
      const isMatch = section.id === `view-${tabName}`;
      section.classList.toggle('hidden', !isMatch);
    });

    const viewInstance = this.views[tabName];
    if (viewInstance && typeof viewInstance.load === 'function') {
      await viewInstance.load();
    }
  }

  bindSidebarAndCheckoutEvents() {
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    const checkoutBtn = document.getElementById('btn-checkout-turno');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', async () => {
        const montoStr = window.prompt(
          'Ingresa el monto declarado en corte de caja al cerrar turno ($ MXN):',
          '0'
        );
        if (montoStr === null) return;

        try {
          await this.session.cerrarTurno(Number(montoStr || 0));
          this.notify('Turno cerrado y corte de caja registrado.', 'success');
          await this.mostrarPantallaLogin();
        } catch (err) {
          this.notify(`Error al cerrar turno: ${err.message}`, 'error');
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.petGroomingApp = app;
  app.init();
});
