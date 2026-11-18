/**
 * SessionManager.js
 * Gestiona el flujo de login por subdominio (Usuario + Contraseña),
 * persiste la sesión en sessionStorage, sincroniza la matriz de Perfiles y Permisos
 * (casillas de selección ver/hacer por perfil) y soporta modo "Impersonate".
 */
export class SessionManager {
  static STORAGE_KEY = 'pet_grooming_saas_session_v1';
  static PERFILES_STORAGE_KEY = 'pet_grooming_perfiles_permisos_v1';

  static DEFAULT_PERFILES = [
    {
      nombre: 'Dueño',
      descripcion: 'Control total de la organización, finanzas, padrón completo, configuración y perfiles.',
      es_sistema: true,
      protegido: true,
      permisos: {
        ver_dashboard: true,
        ver_agenda: true,
        ver_clientes: true,
        ver_inventario: true,
        ver_caja: true,
        ver_config: true,
        buscar_clientes: true,
        crear_clientes_mascotas: true,
        agendar_citas: true,
        gestionar_asistencia_citas: true,
        gestionar_inventario: true,
        registrar_caja: true,
        editar_configuracion: true,
        usar_impersonate: true,
      },
    },
    {
      nombre: 'Administrador',
      descripcion: 'Administración general de sucursal, clientes, agenda, inventario, personal y perfiles.',
      es_sistema: true,
      protegido: false,
      permisos: {
        ver_dashboard: true,
        ver_agenda: true,
        ver_clientes: true,
        ver_inventario: true,
        ver_caja: true,
        ver_config: true,
        buscar_clientes: true,
        crear_clientes_mascotas: true,
        agendar_citas: true,
        gestionar_asistencia_citas: true,
        gestionar_inventario: true,
        registrar_caja: true,
        editar_configuracion: true,
        usar_impersonate: true,
      },
    },
    {
      nombre: 'Recepcionista',
      descripcion: 'Atención en mostrador: búsqueda de clientes, alta de clientes/mascotas, agenda y cobros.',
      es_sistema: true,
      protegido: false,
      permisos: {
        ver_dashboard: true,
        ver_agenda: true,
        ver_clientes: false,
        ver_inventario: true,
        ver_caja: true,
        ver_config: false,
        buscar_clientes: true,
        crear_clientes_mascotas: true,
        agendar_citas: true,
        gestionar_asistencia_citas: true,
        gestionar_inventario: true,
        registrar_caja: true,
        editar_configuracion: false,
        usar_impersonate: false,
      },
    },
    {
      nombre: 'Cajero',
      descripcion: 'Operación de cobros en caja, agenda del día, recepción y venta de productos con escáner.',
      es_sistema: true,
      protegido: false,
      permisos: {
        ver_dashboard: true,
        ver_agenda: true,
        ver_clientes: false,
        ver_inventario: true,
        ver_caja: true,
        ver_config: false,
        buscar_clientes: true,
        crear_clientes_mascotas: true,
        agendar_citas: true,
        gestionar_asistencia_citas: true,
        gestionar_inventario: true,
        registrar_caja: true,
        editar_configuracion: false,
        usar_impersonate: false,
      },
    },
    {
      nombre: 'Estilista',
      descripcion: 'Operación en área de grooming: consulta de citas asignadas, expedientes técnicos e insumos.',
      es_sistema: true,
      protegido: false,
      permisos: {
        ver_dashboard: false,
        ver_agenda: true,
        ver_clientes: false,
        ver_inventario: TrueBooleanFallback(true),
        ver_caja: false,
        ver_config: false,
        buscar_clientes: true,
        crear_clientes_mascotas: false,
        agendar_citas: false,
        gestionar_asistencia_citas: true,
        gestionar_inventario: true,
        registrar_caja: false,
        editar_configuracion: false,
        usar_impersonate: false,
      },
    },
  ];

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

  getPerfiles() {
    try {
      const raw = localStorage.getItem(SessionManager.PERFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return SessionManager.DEFAULT_PERFILES;
  }

  setPerfiles(perfiles) {
    if (!Array.isArray(perfiles) || !perfiles.length) return;
    try {
      localStorage.setItem(SessionManager.PERFILES_STORAGE_KEY, JSON.stringify(perfiles));
    } catch (_) {}
  }

  async sincronizarPerfilesServidor() {
    try {
      const data = await this.api.get('/perfiles');
      if (Array.isArray(data.perfiles) && data.perfiles.length) {
        this.setPerfiles(data.perfiles);
        return data.perfiles;
      }
    } catch (_) {}
    return this.getPerfiles();
  }

  getPerfilConfig(rol = null) {
    const s = this.getSession();
    const roleName = String(rol || (s ? s.rol : 'Dueño')).trim();
    const perfiles = this.getPerfiles();
    const encontrado = perfiles.find(
      (p) => String(p.nombre || '').toLowerCase() === roleName.toLowerCase()
    );
    if (encontrado) return encontrado;
    return (
      SessionManager.DEFAULT_PERFILES.find(
        (p) => p.nombre.toLowerCase() === roleName.toLowerCase()
      ) || SessionManager.DEFAULT_PERFILES[0]
    );
  }

  getPermisosDePerfil(rol = null) {
    const perfil = this.getPerfilConfig(rol);
    return (perfil && perfil.permisos) || {};
  }

  hasPermission(permisoKey, rol = null) {
    const permisos = this.getPermisosDePerfil(rol);
    return Boolean(permisos[permisoKey]);
  }

  isAuthenticated() {
    const s = this.getSession();
    return Boolean(s && s.organizacion_id && s.sucursal_id && s.usuario_id);
  }

  canImpersonate() {
    const s = this.getSession();
    if (!s) return false;
    if (s.is_impersonating && s.original_admin) {
      return (
        ['Dueño', 'Administrador'].includes(s.original_admin.rol) ||
        this.hasPermission('usar_impersonate', s.original_admin.rol)
      );
    }
    return (
      ['Dueño', 'Administrador'].includes(s.rol) ||
      this.hasPermission('usar_impersonate', s.rol)
    );
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
    if (this.canImpersonate()) {
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
      throw new Error('Tu perfil no tiene permiso para usar Impersonate.');
    }

    const originalAdmin = this.getOriginalAdmin();
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

    if (Array.isArray(res.perfiles) && res.perfiles.length) {
      this.setPerfiles(res.perfiles);
    }

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
    const permisos = this.getPermisosDePerfil(roleName);

    const tabMap = [
      { key: 'ver_dashboard', tab: 'dashboard' },
      { key: 'ver_agenda', tab: 'agenda' },
      { key: 'ver_clientes', tab: 'clientes' },
      { key: 'ver_inventario', tab: 'inventario' },
      { key: 'ver_caja', tab: 'caja' },
      { key: 'ver_config', tab: 'config' },
    ];

    const allowed = tabMap.filter((item) => Boolean(permisos[item.key])).map((item) => item.tab);
    return allowed.length ? allowed : ['agenda'];
  }

  aplicarPermisosVisuales() {
    const session = this.getSession();
    if (!session) return [];

    const rolActivo = session.rol;
    const allowedTabs = this.getAllowedTabs(rolActivo);
    const navButtons = document.querySelectorAll('[data-tab-target]');

    navButtons.forEach((btn) => {
      const target = btn.getAttribute('data-tab-target');
      if (allowedTabs.includes(target)) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    });

    // Permisos operativos (HACER) según las casillas del perfil activo
    const canBuscarClientes = this.hasPermission('buscar_clientes', rolActivo);
    const canCrearClientes = this.hasPermission('crear_clientes_mascotas', rolActivo);
    const canAgendarCitas = this.hasPermission('agendar_citas', rolActivo);
    const canGestionarInv = this.hasPermission('gestionar_inventario', rolActivo);
    const canRegistrarCaja = this.hasPermission('registrar_caja', rolActivo);
    const canEditarConfig = this.hasPermission('editar_configuracion', rolActivo);

    // 1. Buscador global y botón Registrar Nuevo Cliente en menú lateral
    const formBuscador = document.getElementById('form-buscador-clientes');
    if (formBuscador) {
      formBuscador.classList.toggle('hidden', !canBuscarClientes);
    }
    const btnNuevoCliente = document.getElementById('btn-sidebar-nuevo-cliente');
    if (btnNuevoCliente) {
      btnNuevoCliente.classList.toggle('hidden', !canCrearClientes);
    }
    const boxBuscadorLateral = document.getElementById('sidebar-buscador-global-box');
    if (boxBuscadorLateral) {
      boxBuscadorLateral.classList.toggle('hidden', !canBuscarClientes && !canCrearClientes);
    }

    // 2. Botón "+ Nueva Cita" en Agenda
    const btnNuevaCitaAgenda = document.getElementById('btn-agenda-abrir-modal-cita');
    if (btnNuevaCitaAgenda) {
      btnNuevaCitaAgenda.classList.toggle('hidden', !canAgendarCitas);
    }

    // 3. Formularios de Inventario y Caja
    const formCrearProd = document.getElementById('form-crear-producto');
    if (formCrearProd) {
      formCrearProd.classList.toggle('hidden', !canGestionarInv);
    }
    const formEscaner = document.getElementById('form-escaner');
    if (formEscaner) {
      formEscaner.classList.toggle('hidden', !canGestionarInv);
    }
    const formCajaManual = document.getElementById('form-caja-manual');
    if (formCajaManual) {
      formCajaManual.classList.toggle('hidden', !canRegistrarCaja);
    }

    // 4. Elementos marcados con data-role-admin-only
    const adminOnlyEls = document.querySelectorAll('[data-role-admin-only]');
    const isAdminOrConfig =
      ['Dueño', 'Administrador'].includes(rolActivo) || canEditarConfig;
    adminOnlyEls.forEach((el) => {
      el.classList.toggle('hidden', !isAdminOrConfig);
    });

    // 5. El botón de Impersonate en el menú lateral permanece visible si el usuario REAL tiene permiso usar_impersonate
    const btnImpersonate = document.getElementById('btn-open-impersonate');
    if (btnImpersonate) {
      btnImpersonate.classList.toggle('hidden', !this.canImpersonate());
    }

    return allowedTabs;
  }
}

function TrueBooleanFallback(val) {
  return Boolean(val);
}
