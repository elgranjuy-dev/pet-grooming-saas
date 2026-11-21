/**
 * App.js
 * Controlador principal POO del Frontend Operativo.
 * Inicializa ApiClient, SessionManager, WidgetManager y las vistas modulares, gestionando
 * el flujo de login por subdominio (Usuario + Contraseña), vistas dinámicas por rol,
 * modo Impersonate para Administrador/Dueño, barra lateral colapsable y Check-Out.
 */
import { ApiClient } from './core/ApiClient.js?v=0.9.4';
import { SessionManager } from './core/SessionManager.js?v=0.9.4';
import { WidgetManager } from './core/WidgetManager.js?v=0.9.4';
import { DashboardView } from './views/DashboardView.js?v=0.9.4';
import { AgendaView } from './views/AgendaView.js?v=0.9.4';
import { ClientesView } from './views/ClientesView.js?v=0.9.4';
import { InventarioCajaView } from './views/InventarioCajaView.js?v=0.9.4';
import { ConfigPersonalView } from './views/ConfigPersonalView.js?v=0.9.4';

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
    this.bindImpersonateEvents();

    if (this.session.isAuthenticated()) {
      await this.session.sincronizarPerfilesServidor();
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
    document.getElementById('impersonate-banner')?.classList.add('hidden');
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

    this.actualizarBannerImpersonate();
    this.renderBotonesImpersonatePerfiles();

    const allowedTabs = this.session.aplicarPermisosVisuales();
    const targetTab = allowedTabs.includes(this.activeTab)
      ? this.activeTab
      : allowedTabs.includes('dashboard')
      ? 'dashboard'
      : allowedTabs[0] || 'agenda';
    this.switchTab(targetTab);
  }

  actualizarBannerImpersonate() {
    const s = this.session.getSession();
    const banner = document.getElementById('impersonate-banner');
    const targetNameEl = document.getElementById('impersonate-banner-target-name');
    const targetRoleEl = document.getElementById('impersonate-banner-target-role');
    const adminNameEl = document.getElementById('impersonate-banner-admin-name');
    const btnOpenSidebar = document.getElementById('btn-open-impersonate');
    const labelSidebar = document.getElementById('label-btn-impersonate');

    const isImp = this.session.isImpersonating();

    if (banner) {
      banner.classList.toggle('hidden', !isImp);
    }

    if (isImp && s) {
      if (targetNameEl) targetNameEl.textContent = s.usuario_nombre;
      if (targetRoleEl) targetRoleEl.textContent = s.rol;
      if (adminNameEl) {
        adminNameEl.textContent = s.original_admin?.usuario_nombre || 'Administrador';
      }
      if (labelSidebar) {
        labelSidebar.textContent = `Impersonating: ${s.rol}`;
      }
      if (btnOpenSidebar) {
        btnOpenSidebar.className =
          'w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white text-xs font-extrabold transition flex items-center justify-center gap-2 shadow';
      }
    } else {
      if (labelSidebar) {
        labelSidebar.textContent = 'Impersonate';
      }
      if (btnOpenSidebar) {
        btnOpenSidebar.className =
          'w-full py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-300 text-xs font-bold transition flex items-center justify-center gap-2';
      }
    }
  }

  bindImpersonateEvents() {
    const btnOpenSidebar = document.getElementById('btn-open-impersonate');
    const btnChangeTop = document.getElementById('btn-change-impersonate-top');
    const btnExitTop = document.getElementById('btn-exit-impersonate-top');
    const btnCloseModal = document.getElementById('btn-cerrar-modal-impersonate');
    const btnRestoreModal = document.getElementById('btn-modal-restore-admin');
    const modal = document.getElementById('modal-impersonate');

    if (btnOpenSidebar) {
      btnOpenSidebar.addEventListener('click', () => this.abrirModalImpersonate());
    }
    if (btnChangeTop) {
      btnChangeTop.addEventListener('click', () => this.abrirModalImpersonate());
    }
    if (btnExitTop) {
      btnExitTop.addEventListener('click', () => this.salirDeImpersonate());
    }
    if (btnRestoreModal) {
      btnRestoreModal.addEventListener('click', () => this.salirDeImpersonate());
    }
    if (btnCloseModal && modal) {
      btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }

    this.renderBotonesImpersonatePerfiles();
  }

  renderBotonesImpersonatePerfiles() {
    const rolesListEl = document.getElementById('impersonate-roles-list');
    if (!rolesListEl) return;

    const perfiles = this.session.getPerfiles();
    if (Array.isArray(perfiles) && perfiles.length) {
      rolesListEl.innerHTML = perfiles
        .map((p) => {
          const totalActivos = Object.values(p.permisos || {}).filter(Boolean).length;
          return `
            <button type="button" data-impersonate-role="${p.nombre}"
              class="p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-left transition group cursor-pointer">
              <p class="font-extrabold text-slate-800 group-hover:text-blue-700 flex items-center justify-between">
                <span class="truncate">${p.nombre}</span>
                <i class="fa-solid fa-arrow-right text-[10px] text-slate-400 group-hover:text-blue-600"></i>
              </p>
              <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1">${totalActivos} permisos activos</p>
            </button>
          `;
        })
        .join('');
    }

    rolesListEl.querySelectorAll('[data-impersonate-role]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rol = btn.getAttribute('data-impersonate-role');
        if (!rol) return;
        const orig = this.session.getOriginalAdmin();
        await this.ejecutarImpersonate({
          id: orig?.usuario_id,
          nombre: `Perfil ${rol}`,
          rol,
          es_rol_virtual: true,
        });
      });
    });
  }

  async abrirModalImpersonate() {
    if (!this.session.canImpersonate()) {
      this.notify('Tu perfil no tiene permiso para usar Impersonate.', 'warning');
      return;
    }

    this.renderBotonesImpersonatePerfiles();

    const modal = document.getElementById('modal-impersonate');
    const listContainer = document.getElementById('impersonate-users-list');
    const activeBox = document.getElementById('modal-impersonate-active-box');
    const activeDesc = document.getElementById('modal-impersonate-active-desc');

    if (!modal || !listContainer) return;

    const currentSession = this.session.getSession();
    const isImp = this.session.isImpersonating();
    const origAdmin = this.session.getOriginalAdmin();

    if (activeBox) {
      activeBox.classList.toggle('hidden', !isImp);
      if (isImp && activeDesc && currentSession) {
        activeDesc.textContent = `Viendo como: ${currentSession.usuario_nombre} (${currentSession.rol})`;
      }
    }

    modal.classList.remove('hidden');
    listContainer.innerHTML = `<div class="p-3 text-center text-slate-400">Cargando colaboradores de la sucursal...</div>`;

    try {
      const usuarios = await this.session.listarUsuariosSucursal();
      if (!usuarios.length) {
        listContainer.innerHTML = `<div class="p-3 text-center text-slate-400 bg-slate-50 rounded-xl">No hay otros colaboradores registrados aún. Puedes usar la simulación rápida por rol abajo.</div>`;
        return;
      }

      const badgeColor = (rol) => {
        const map = {
          'Dueño': 'bg-purple-100 text-purple-800',
          'Administrador': 'bg-indigo-100 text-indigo-800',
          'Recepcionista': 'bg-amber-100 text-amber-800',
          'Cajero': 'bg-emerald-100 text-emerald-800',
          'Estilista': 'bg-blue-100 text-blue-800',
        };
        return map[rol] || 'bg-slate-100 text-slate-700';
      };

      listContainer.innerHTML = usuarios
        .map((u) => {
          const esAdminOriginal = origAdmin && u.id === origAdmin.usuario_id;
          const esActivoActual =
            currentSession &&
            u.id === currentSession.usuario_id &&
            u.nombre === currentSession.usuario_nombre &&
            u.rol === currentSession.rol;

          return `
            <div class="flex items-center justify-between gap-3 p-3 rounded-xl border ${
              esActivoActual
                ? 'border-blue-500 bg-blue-50/70'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } transition">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl ${
                  esActivoActual ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                } flex items-center justify-center font-extrabold shrink-0">
                  ${(u.nombre || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                  <p class="font-extrabold text-slate-900 truncate">
                    ${u.nombre}
                    ${
                      esAdminOriginal
                        ? '<span class="ml-1 text-[10px] font-bold text-slate-400">(Tu usuario Admin)</span>'
                        : ''
                    }
                  </p>
                  <span class="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor(
                    u.rol
                  )}">${u.rol}</span>
                </div>
              </div>
              <div class="shrink-0">
                ${
                  esActivoActual
                    ? `<span class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] inline-flex items-center gap-1">
                        <i class="fa-solid fa-check text-[10px]"></i> Activo
                      </span>`
                    : `<button type="button" data-impersonate-uid="${u.id}"
                        class="btn-select-impersonate-user px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] transition inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-user-secret text-[10px]"></i>
                        <span>${esAdminOriginal ? 'Volver a Admin' : 'Impersonate'}</span>
                      </button>`
                }
              </div>
            </div>
          `;
        })
        .join('');

      listContainer.querySelectorAll('.btn-select-impersonate-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-impersonate-uid');
          const target = usuarios.find((x) => x.id === uid);
          if (target) {
            await this.ejecutarImpersonate(target);
          }
        });
      });
    } catch (err) {
      listContainer.innerHTML = `<div class="p-3 text-center text-red-600 bg-red-50 rounded-xl">${
        err.message || 'No se pudo cargar la lista de usuarios.'
      }</div>`;
    }
  }

  async ejecutarImpersonate(targetUser) {
    try {
      const updated = await this.session.iniciarImpersonate(targetUser);
      document.getElementById('modal-impersonate')?.classList.add('hidden');
      this.mostrarPanelOperativo();

      if (updated.is_impersonating) {
        this.notify(
          `Modo Impersonate activo: viendo como ${updated.usuario_nombre} (${updated.rol})`,
          'info'
        );
      } else {
        this.notify(`Has regresado a tu sesión de ${updated.rol}.`, 'success');
      }
    } catch (err) {
      this.notify(err.message || 'No fue posible activar Impersonate.', 'error');
    }
  }

  async salirDeImpersonate() {
    try {
      const restored = await this.session.detenerImpersonate();
      document.getElementById('modal-impersonate')?.classList.add('hidden');
      this.mostrarPanelOperativo();
      this.notify(
        `Modo Impersonate finalizado. Sesión restaurada: ${restored.usuario_nombre} (${restored.rol})`,
        'success'
      );
    } catch (err) {
      this.notify(err.message || 'Error al salir de Impersonate.', 'error');
    }
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
      this.notify('El perfil actual no tiene acceso a este módulo.', 'warning');
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
    const modalCorte = document.getElementById('modal-corte-caja');
    const btnCerrarCorte = document.getElementById('btn-cerrar-modal-corte-caja');
    const btnCancelarCorte = document.getElementById('btn-cancelar-modal-corte-caja');
    const formCorte = document.getElementById('form-corte-caja-turno');
    const inputFondo = document.getElementById('corte-fondo-inicial');
    const inputContado = document.getElementById('corte-efectivo-contado');

    this._efectivoVentasHoy = 0;

    const actualizarDiferenciaCorte = () => {
      const fondo = Number(inputFondo?.value || 0);
      const contado = Number(inputContado?.value || 0);
      const esperadoTotal = fondo + (this._efectivoVentasHoy || 0);
      const diff = Number((contado - esperadoTotal).toFixed(2));

      const boxEl = document.getElementById('corte-diferencia-box');
      const valEl = document.getElementById('corte-diferencia-valor');
      if (!boxEl || !valEl) return;

      if (Math.abs(diff) < 0.01) {
        boxEl.className = 'p-2.5 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-between';
        valEl.className = 'font-mono font-black text-sm text-emerald-800';
        valEl.textContent = '$0.00 (Cuadre exacto)';
      } else if (diff > 0) {
        boxEl.className = 'p-2.5 rounded-xl bg-blue-100/80 border border-blue-300 flex items-center justify-between';
        valEl.className = 'font-mono font-black text-sm text-blue-800';
        valEl.textContent = `+$${diff.toFixed(2)} (Sobrante en caja)`;
      } else {
        boxEl.className = 'p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 flex items-center justify-between';
        valEl.className = 'font-mono font-black text-sm text-rose-800';
        valEl.textContent = `-$${Math.abs(diff).toFixed(2)} (Faltante en caja)`;
      }
    };

    if (inputFondo) inputFondo.addEventListener('input', actualizarDiferenciaCorte);
    if (inputContado) inputContado.addEventListener('input', actualizarDiferenciaCorte);

    if (btnCerrarCorte && modalCorte) {
      btnCerrarCorte.addEventListener('click', () => modalCorte.classList.add('hidden'));
    }
    if (btnCancelarCorte && modalCorte) {
      btnCancelarCorte.addEventListener('click', () => modalCorte.classList.add('hidden'));
    }

    if (btnCheckout) {
      btnCheckout.addEventListener('click', async () => {
        if (!modalCorte) return;
        modalCorte.classList.remove('hidden');

        try {
          const hoyIso = new Date().toLocaleDateString('sv-SE');
          const dataCaja = await this.api.get('/caja');
          const movs = (dataCaja.movimientos || []).filter((m) =>
            String(m.fecha || '').startswith
              ? String(m.fecha || '').startsWith(hoyIso)
              : String(m.fecha || '').slice(0, 10) === hoyIso
          );

          let efec = 0;
          let tarj = 0;
          let transf = 0;
          movs.forEach((m) => {
            const monto = Number(m.monto || 0);
            const mp = String(m.metodo_pago || 'Efectivo').toLowerCase();
            if (mp.includes('tarjeta')) tarj += monto;
            else if (mp.includes('transfer')) transf += monto;
            else efec += monto;
          });

          this._efectivoVentasHoy = efec;
          const elEfec = document.getElementById('corte-efectivo-esperado');
          const elTarj = document.getElementById('corte-tarjeta-hoy');
          const elTransf = document.getElementById('corte-transferencia-hoy');
          if (elEfec) elEfec.textContent = `$${efec.toFixed(2)}`;
          if (elTarj) elTarj.textContent = `$${tarj.toFixed(2)}`;
          if (elTransf) elTransf.textContent = `$${transf.toFixed(2)}`;
          if (inputFondo) inputFondo.value = '0';
          if (inputContado) inputContado.value = efec.toFixed(2);
          actualizarDiferenciaCorte();
        } catch (_) {}
      });
    }

    if (formCorte) {
      formCorte.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monto = Number(inputContado?.value || 0);
        try {
          await this.session.cerrarTurno(monto);
          modalCorte?.classList.add('hidden');
          this.notify('Corte de caja registrado y turno cerrado correctamente.', 'info');
          await this.mostrarPantallaLogin();
        } catch (err) {
          this.session.clearSession();
          modalCorte?.classList.add('hidden');
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
