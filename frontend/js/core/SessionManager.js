/**
 * SessionManager.js
 * Gestiona el flujo de login (vinculación corporativa SaaS por correo/contraseña,
 * contexto inicial, usuarios por sucursal, validación de PIN),
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
    this.organizaciones = [];
    this.sucursales = [];
    this.usuariosSucursal = [];
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

  async cargarContextoInicial() {
    const data = await this.api.get('/contexto-inicial');
    this.organizaciones = data.organizaciones || [];
    this.sucursales = data.sucursales || [];
    return data;
  }

  async conectarOrganizacionSaaS({ email, password }) {
    const data = await this.api.post('/auth/organizacion', {
      email,
      password,
    });
    if (data.organizacion) {
      const idx = this.organizaciones.findIndex((o) => o.id === data.organizacion.id);
      if (idx >= 0) {
        this.organizaciones[idx] = data.organizacion;
      } else {
        this.organizaciones.unshift(data.organizacion);
      }
    }
    if (Array.isArray(data.sucursales) && data.sucursales.length) {
      this.sucursales = data.sucursales;
    }
    return data;
  }

  obtenerSucursalesPorOrganizacion(organizacionId) {
    const org = this.organizaciones.find((o) => o.id === organizacionId);
    if (org && Array.isArray(org.sucursales) && org.sucursales.length > 0) {
      return org.sucursales;
    }
    return this.sucursales.filter((s) => s.organizacion_id === organizacionId);
  }

  async cargarUsuariosSucursal(sucursalId, organizacionId = '') {
    if (!sucursalId) return [];
    const data = await this.api.get(`/sucursales/${sucursalId}/usuarios`, {
      organizacion_id: organizacionId,
    });
    this.usuariosSucursal = data.usuarios || [];
    return this.usuariosSucursal;
  }

  async iniciarSesionPin({ organizacionId, sucursalId, usuarioId, pin }) {
    const res = await this.api.post('/auth/login-pin', {
      organizacion_id: organizacionId,
      sucursal_id: sucursalId,
      usuario_id: usuarioId,
      pin,
    });

    const org = this.organizaciones.find((o) => o.id === organizacionId) || {};
    const suc = this.sucursales.find((s) => s.id === sucursalId) || {};
    const usr = res.usuario || {};
    const asistencia = res.asistencia || {};

    const sessionPayload = {
      organizacion_id: organizacionId,
      organizacion_nombre: org.nombre || 'Organización',
      organizacion_plan: org.plan || 'Pro',
      sucursal_id: sucursalId,
      sucursal_nombre: suc.nombre || 'Sucursal',
      usuario_id: usr.id || usuarioId,
      usuario_nombre: usr.nombre || 'Usuario',
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

    const res = await this.api.post('/checkout', {
      asistencia_id: session.asistencia_id,
      usuario_id: session.usuario_id,
      monto_corte_caja: Number(montoCorteCaja || 0),
    });

    this.clearSession();
    return res;
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
