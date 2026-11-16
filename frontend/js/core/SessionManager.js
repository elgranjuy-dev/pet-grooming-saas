/**
 * SessionManager.js
 * Gestiona el flujo de login por subdominio (Usuario + Contraseña),
 * persiste la sesión en sessionStorage y aplica permisos visuales por rol.
 */
export class SessionManager {
  static STORAGE_KEY = 'pet_grooming_saas_session_v1';

  // Permisos de pestañas visibles según el rol del usuario
  static ROLE_PERMISSIONS = {
    'Dueño': ['dashboard', 'agenda', 'clientes', 'inventario', 'caja', 'config'],
    'Administrador': ['dashboard', 'agenda', 'clientes', 'inventario', 'caja', 'config'],
    'Recepcionista': ['dashboard', 'agenda', 'clientes', 'inventario', 'caja'],
    'Cajero': ['dashboard', 'agenda', 'clientes', 'inventario', 'caja'],
    'Estilista': ['agenda', 'clientes', 'inventario'],
  };

  constructor(apiClient) {
    this.api = apiClient;
    this.tenantDetectado = null;
    this.organizaciones = [];
    this.sucursales = [];
  }

  getSession() {
    try {
      const raw = sessionStorage.getItem(SessionManager.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  saveSession(sessionData) {
    sessionStorage.setItem(SessionManager.STORAGE_KEY, JSON.stringify(sessionData));
  }

  clearSession() {
    sessionStorage.removeItem(SessionManager.STORAGE_KEY);
  }

  isAuthenticated() {
    const s = this.getSession();
    return Boolean(s && s.organizacion_id && s.sucursal_id && s.usuario_id);
  }

  detectarSubdominio() {
    const params = new URLSearchParams(window.location.search);
    const paramTenant = params.get('tenant') || params.get('subdominio') || params.get('org');
    if (paramTenant) return paramTenant.trim().toLowerCase();

    const host = (window.location.hostname || '').toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 2 && !['www', 'localhost', '127', 'app', 'api'].includes(parts[0])) {
      return parts[0];
    }
    return '';
  }

  async cargarContextoInicial() {
    const subdominio = this.detectarSubdominio();
    const data = await this.api.get('/contexto-inicial', subdominio ? { subdominio } : {});
    this.tenantDetectado = data.tenant_detectado || null;
    this.organizaciones = data.organizaciones || [];
    this.sucursales = data.sucursales || [];
    return data;
  }

  async iniciarSesionTenant({ usuario, password }) {
    const subdominio = this.detectarSubdominio();
    const res = await this.api.post('/auth/login-tenant', {
      usuario,
      password,
      subdominio: subdominio || undefined,
    });

    const org = res.organizacion || {};
    const suc = res.sucursal || {};
    const usr = res.usuario || {};
    const asistencia = res.asistencia || {};

    const sessionPayload = {
      organizacion_id: res.organizacion_id || org.id,
      organizacion_nombre: res.organizacion_nombre || org.nombre || 'Organización',
      organizacion_plan: res.plan || org.plan || 'Pro',
      sucursal_id: res.sucursal_id || suc.id,
      sucursal_nombre: res.sucursal_nombre || suc.nombre || 'Sucursal Matriz',
      usuario_id: usr.id,
      usuario_nombre: usr.nombre || usuario,
      rol: usr.rol || 'Estilista',
      asistencia_id: asistencia.id || null,
      hora_entrada: asistencia.hora_entrada || new Date().toISOString(),
    };

    this.saveSession(sessionPayload);
    return sessionPayload;
  }

  async cerrarTurno(montoCorteCaja = 0) {
    const session = this.getSession();
    if (!session) return null;

    try {
      const res = await this.api.post('/checkout', {
        asistencia_id: session.asistencia_id,
        usuario_id: session.usuario_id,
        monto_corte_caja: Number(montoCorteCaja || 0),
      });
      this.clearSession();
      return res;
    } catch (err) {
      this.clearSession();
      throw err;
    }
  }

  getAllowedTabs(rol = null) {
    const session = this.getSession();
    const roleName = rol || (session ? session.rol : 'Dueño');
    return (
      SessionManager.ROLE_PERMISSIONS[roleName] ||
      SessionManager.ROLE_PERMISSIONS['Dueño']
    );
  }

  aplicarPermisosVisuales() {
    const session = this.getSession();
    if (!session) return [];

    const allowedTabs = this.getAllowedTabs(session.rol);
    const navButtons = document.querySelectorAll('[data-tab-target]');

    navButtons.forEach((btn) => {
      const target = btn.getAttribute('data-tab-target');
      if (allowedTabs.includes(target)) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    });

    const adminOnlyEls = document.querySelectorAll('[data-role-admin-only]');
    const isAdmin = ['Dueño', 'Administrador'].includes(session.rol);
    adminOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', !isAdmin);
    });

    return allowedTabs;
  }
}
