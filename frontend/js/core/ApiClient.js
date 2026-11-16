/**
 * ApiClient.js
 * Cliente HTTP POO desacoplado con URL base configurable (window.API_BASE_URL || 'http://localhost:8000/api')
 * que inyecta automáticamente encabezados y parámetros de contexto multi-tenant y auditoría.
 */
export class ApiClient {
  constructor(sessionManager = null) {
    this.baseUrl = (window.API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
    this.sessionManager = sessionManager;
  }

  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
  }

  getContext() {
    if (!this.sessionManager) return {};
    const session = this.sessionManager.getSession();
    if (!session) return {};
    return {
      organizacion_id: session.organizacion_id || '',
      sucursal_id: session.sucursal_id || '',
      usuario_activo: session.usuario_nombre || 'Sistema',
      rol_activo: session.rol || 'Operativo',
    };
  }

  buildUrl(endpoint, queryParams = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);
    const ctx = this.getContext();

    if (ctx.organizacion_id && !queryParams.organizacion_id) {
      url.searchParams.set('organizacion_id', ctx.organizacion_id);
    }
    if (ctx.sucursal_id && !queryParams.sucursal_id) {
      url.searchParams.set('sucursal_id', ctx.sucursal_id);
    }

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  buildHeaders(customHeaders = {}) {
    const ctx = this.getContext();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    if (ctx.organizacion_id) {
      headers['X-Organizacion-Id'] = ctx.organizacion_id;
    }
    if (ctx.sucursal_id) {
      headers['X-Sucursal-Id'] = ctx.sucursal_id;
    }
    if (ctx.usuario_activo) {
      headers['X-Usuario-Activo'] = encodeURIComponent(ctx.usuario_activo);
    }
    if (ctx.rol_activo) {
      headers['X-Rol-Activo'] = encodeURIComponent(ctx.rol_activo);
    }

    return headers;
  }

  enrichBody(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }
    const ctx = this.getContext();
    return {
      organizacion_id: ctx.organizacion_id || undefined,
      sucursal_id: ctx.sucursal_id || undefined,
      usuario_actual: ctx.usuario_activo || 'Sistema',
      rol_actual: ctx.rol_activo || 'Operativo',
      ...body,
    };
  }

  async request(method, endpoint, { params = {}, body = null, headers = {} } = {}) {
    const url = this.buildUrl(endpoint, params);
    const options = {
      method,
      headers: this.buildHeaders(headers),
    };

    if (body !== null && method !== 'GET') {
      options.body = JSON.stringify(this.enrichBody(body));
    }

    const response = await fetch(url, options);
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      const message = data.detail || data.mensaje || `Error HTTP ${response.status}`;
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }

    return data;
  }

  get(endpoint, params = {}) {
    return this.request('GET', endpoint, { params });
  }

  post(endpoint, body = {}, params = {}) {
    return this.request('POST', endpoint, { body, params });
  }

  put(endpoint, body = {}, params = {}) {
    return this.request('PUT', endpoint, { body, params });
  }

  delete(endpoint, params = {}) {
    return this.request('DELETE', endpoint, { params });
  }
}
