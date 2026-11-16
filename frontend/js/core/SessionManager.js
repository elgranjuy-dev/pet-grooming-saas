/**
 * SessionManager.js
 * Gestiona el flujo de login por subdominio (Usuario + Contraseña),
 * persiste la sesión en sessionStorage, aplica permisos visuales por rol
 * y soporta modo "Impersonate" exclusivo para Dueño / Administrador.
 */
export class SessionManager {
  static STORAGE_KEY = 'pet_grooming_saas_session_v1';

  // Permisos de pestañas visibles según el rol del usuario activo (o simulado en Impersonate)
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

  canImpersonate() {
    const s = this.getSession();
    if (!s) return false;
    if (s.is_impersonating && s.original_admin) {
      return ['Dueño', 'Administrador'].includes(s.original_admin.rol);
    }
    return ['Dueño', 'Administrador'].includes(s.rol);
  }

  isImpersonating() {
    const s = this.getSession();
    return Boolean(s && s.is_impersonating && s.original_admin);
  }

  getOriginalAdmin() {
    const s = this.getSession();
    if (!s) return null;
    if (s.is_impersonating && s.original_admin) {
      return s.original_admin;
    }
    if (['Dueño', 'Administrador'].includes(s.rol)) {
      return {
        usuario_id: s.usuario_id,
        usuario_nombre: s.usuario_nombre,
        rol: s.rol,
      };
    }
    return null;
  }

  async listarUsuariosSucursal() {
    const s = this.getSession();
    if (!s || !s.sucursal_id) return [];
    const data = await this.api.get(`/sucursales/${s.sucursal_id}/usuarios`, {
      organizacion_id: s.organizacion_id,
    });
    return data.usuarios || [];
  }

  async iniciarImpersonate(targetUser) {
    const s = this.getSession();
    if (!s || !this.canImpersonate()) {
      throw new Error('Solo un Administrador o Dueño puede usar Impersonate.');
    }

    const originalAdmin = this.getOriginalAdmin();
    // Si selecciona su propio usuario original de admin, equivale a salir de impersonate
    if (
      originalAdmin &&
      targetUser.id === originalAdmin.usuario_id &&
      targetUser.rol === originalAdmin.rol &&
      !targetUser.es_rol_virtual
    ) {
      return await this.detenerImpersonate();
    }

    const updatedSession = {
      ...s,
      usuario_id: targetUser.id || originalAdmin.usuario_id,
      usuario_nombre: targetUser.nombre,
      rol: targetUser.rol,
      is_impersonating: true,
      original_admin: originalAdmin,
    };

    this.saveSession(updatedSession);

    try {
      await this.api.post('/auth/impersonate', {
        accion: 'iniciar',
        organizacion_id: s.organizacion_id,
        sucursal_id: s.sucursal_id,
        admin_nombre: originalAdmin.usuario_nombre,
        admin_rol: originalAdmin.rol,
        target_nombre: targetUser.nombre,
        target_rol: targetUser.rol,
      });
    } catch (_) {}

    return updatedSession;
  }

  async detenerImpersonate() {
    const s = this.getSession();
    if (!s || !s.is_impersonating || !s.original_admin) {
      return s;
    }

    const originalAdmin = s.original_admin;
    const restoredSession = {
      ...s,
      usuario_id: originalAdmin.usuario_id,
      usuario_nombre: originalAdmin.usuario_nombre,
      rol: originalAdmin.rol,
      is_impersonating: false,
      original_admin: null,
    };

    this.saveSession(restoredSession);

    try {
      await this.api.post('/auth/impersonate', {
        accion: 'salir',
        organizacion_id: s.organizacion_id,
        sucursal_id: s.sucursal_id,
        admin_nombre: originalAdmin.usuario_nombre,
        admin_rol: originalAdmin.rol,
      });
    } catch (_) {}

    return restoredSession;
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
      is_impersonating: false,
      original_admin: null,
    };

    this.saveSession(sessionPayload);
    return sessionPayload;
  }

  async cerrarTurno(montoCorteCaja = 0) {
    const session = this.getSession();
    if (!session) return null;

    const realUserId =
      session.is_impersonating && session.original_admin
        ? session.original_admin.usuario_id
        : session.usuario_id;

    try {
      const res = await this.api.post('/checkout', {
        asistencia_id: session.asistencia_id,
        usuario_id: realUserId,
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

    // Los elementos exclusivos del rol activo se ocultan si el rol simulado no es Admin/Dueño
    const adminOnlyEls = document.querySelectorAll('[data-role-admin-only]');
    const isAdmin = ['Dueño', 'Administrador'].includes(session.rol);
    adminOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', !isAdmin);
    });

    // El botón de Impersonate en el menú lateral permanece visible si el usuario REAL es Dueño/Administrador
    const btnImpersonate = document.getElementById('btn-open-impersonate');
    if (btnImpersonate) {
      btnImpersonate.classList.toggle('hidden', !this.canImpersonate());
    }

    return allowedTabs;
  }
}
