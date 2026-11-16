/**
 * App.js
 * Controlador principal POO del Frontend Operativo.
 * Inicializa ApiClient, SessionManager y las vistas modulares, gestionando
 * el flujo de login por subdominio (Usuario + Contraseña), vistas dinámicas por rol,
 * barra lateral colapsable y Check-Out.
 */
import { ApiClient } from './core/ApiClient.js?v=0.5.0';
import { SessionManager } from './core/SessionManager.js?v=0.5.0';
import { WidgetManager } from './core/WidgetManager.js?v=0.5.0';
import { DashboardView } from './views/DashboardView.js?v=0.5.0';
import { AgendaView } from './views/AgendaView.js?v=0.5.0';
import { ClientesView } from './views/ClientesView.js?v=0.5.0';
import { InventarioCajaView } from './views/InventarioCajaView.js?v=0.5.0';
import { ConfigPersonalView } from './views/ConfigPersonalView.js?v=0.5.0';

export class App {
  constructor() {
    this.api = new ApiClient();
    this.session = new SessionManager(this.api);
    this.api.setSessionManager(this.session);

    const notifyBound = this.notify.bind(this);
    this.widgets = new WidgetManager(notifyBound);
    this.views = {
      dashboard: new DashboardView(this.api, notifyBound),
      agenda: new AgendaView(this.api, notifyBound),
      clientes: new ClientesView(this.api, notifyBound),
      inventario: new InventarioCajaView(this.api, notifyBound),
      caja: null,
      config: new ConfigPersonalView(this.api, notifyBound),
    };
    this.views.caja = this.views.inventario;
    this.activeTab = 'dashboard';
  }

  async init() {
    this.widgets.init();
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
    const formLogin = document.getElementById('form-login-tenant');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.ejecutarLoginTenant();
      });
    }
  }

  async mostrarPantallaLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-shell')?.classList.add('hidden');

    try {
      const ctx = await this.session.cargarContextoInicial();
      const tenant = ctx.tenant_detectado;
      if (tenant) {
        const nombreEl = document.getElementById('login-tenant-nombre');
        const subEl = document.getElementById('login-tenant-subdominio');
        if (nombreEl) nombreEl.textContent = tenant.nombre;
        if (subEl) {
          subEl.textContent = `Acceso al sistema · ${tenant.subdominio || 'portal'}.petgrooming.mx`;
        }
      }
    } catch (_) {
      // Si aún no hay conexión, mantiene título por defecto
    }
  }

  async ejecutarLoginTenant() {
    const usuario = document.getElementById('login-usuario-input')?.value.trim();
    const password = document.getElementById('login-password-input')?.value.trim();

    if (!usuario || !password) {
      this.notify('Ingresa tu usuario y contraseña.', 'warning');
      return;
    }

    try {
      const sesion = await this.session.iniciarSesionTenant({
        usuario,
        password,
      });
      const passInput = document.getElementById('login-password-input');
      if (passInput) passInput.value = '';
      this.notify(
        `Sesión iniciada: ${sesion.usuario_nombre} — Vista ${sesion.rol}`,
        'success'
      );
      this.mostrarPanelOperativo();
    } catch (err) {
      this.notify(err.message || 'Usuario o contraseña incorrectos.', 'error');
    }
  }

  mostrarPanelOperativo() {
    const s = this.session.getSession();
    if (!s) return;

    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');

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
    const allowedTabs = this.session.getAllowedTabs();
    if (!allowedTabs.includes(tabName)) {
      this.notify('Tu rol no tiene acceso a este módulo.', 'warning');
      return;
    }

    this.activeTab = tabName;

    document.querySelectorAll('[data-tab-target]').forEach((btn) => {
      const isTarget = btn.getAttribute('data-tab-target') === tabName;
      btn.classList.toggle('active', isTarget);
      btn.classList.toggle('bg-blue-600', isTarget);
      btn.classList.toggle('text-white', isTarget);
      btn.classList.toggle('text-slate-300', !isTarget);
    });

    document.querySelectorAll('.tab-view').forEach((section) => {
      section.classList.add('hidden');
    });

    const activeSection = document.getElementById(`view-${tabName}`);
    if (activeSection) {
      activeSection.classList.remove('hidden');
    }

    const viewInstance = this.views[tabName];
    if (viewInstance && typeof viewInstance.load === 'function') {
      await viewInstance.load();
    }
  }

  aplicarPosicionMenu(pos) {
    const appShell = document.getElementById('app-shell');
    const sidebar = document.getElementById('sidebar');
    const iconEl = document.getElementById('icon-toggle-menu-pos');
    const labelEl = document.getElementById('label-toggle-menu-pos');
    if (!appShell) return;

    const esTop = pos === 'top';
    appShell.classList.toggle('menu-top', esTop);
    if (esTop && sidebar) {
      sidebar.classList.remove('collapsed');
    }

    if (iconEl) {
      iconEl.className = esTop
        ? 'fa-solid fa-table-columns text-xs'
        : 'fa-solid fa-arrow-up-from-bracket text-xs';
    }
    if (labelEl) {
      labelEl.textContent = esTop ? 'Menú Izquierda' : 'Menú Arriba';
    }
    try {
      localStorage.setItem('pet_grooming_menu_position', esTop ? 'top' : 'left');
    } catch (_) {}
  }

  bindSidebarAndCheckoutEvents() {
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnToggleMenuPos = document.getElementById('btn-toggle-menu-pos');
    const sidebar = document.getElementById('sidebar');
    const appShell = document.getElementById('app-shell');

    // Restaurar preferencia guardada (izquierda por defecto)
    try {
      const savedPos = localStorage.getItem('pet_grooming_menu_position') || 'left';
      this.aplicarPosicionMenu(savedPos);
    } catch (_) {}

    if (btnToggleMenuPos && appShell) {
      btnToggleMenuPos.addEventListener('click', () => {
        const nuevaPos = appShell.classList.contains('menu-top') ? 'left' : 'top';
        this.aplicarPosicionMenu(nuevaPos);
        this.notify(
          nuevaPos === 'top'
            ? 'Menú movido a la parte superior.'
            : 'Menú movido a la parte izquierda.',
          'info'
        );
      });
    }

    if (btnToggleSidebar && sidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    const btnCheckout = document.getElementById('btn-checkout-turno');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', async () => {
        const montoStr = window.prompt(
          'Corte de Caja al finalizar turno ($ MXN):\nIngresa el monto efectivo en caja (o 0 si no aplica):',
          '0'
        );
        if (montoStr === null) return;

        const monto = Number(montoStr) || 0;
        try {
          await this.session.cerrarTurno(monto);
          this.notify('Turno cerrado y salida registrada en asistencia.', 'info');
          await this.mostrarPantallaLogin();
        } catch (err) {
          this.session.clearSession();
          this.notify(`Sesión finalizada (${err.message})`, 'warning');
          await this.mostrarPantallaLogin();
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.petGroomingApp = app;
});
