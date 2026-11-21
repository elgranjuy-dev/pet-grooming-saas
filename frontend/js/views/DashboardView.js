/**
 * DashboardView.js
 * Vista POO encargada de renderizar KPIs financieros/operativos, gráficas Chart.js,
 * alertas de stock bajo y próximas citas de la sucursal activa.
 */
export class DashboardView {
  constructor(apiClient, notify) {
    this.api = apiClient;
    this.notify = notify;
    this.chartMetodos = null;
    this.chartServicios = null;
  }

  init() {
    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.load());
    }
  }

  async load() {
    try {
      const fecha_local = new Date().toLocaleDateString('sv-SE');
      const data = await this.api.get('/dashboard', { fecha_local });
      this.renderKpis(data.kpis || {});
      this.renderCharts(data.graficas || {});
      this.renderAlertasStock(data.alertas_stock || []);
      this.renderProximasCitas(data.proximas_citas || []);
    } catch (err) {
      this.notify(`Error al cargar Dashboard: ${err.message}`, 'error');
    }
  }

  formatCurrency(val) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(val || 0));
  }

  formatearFechaHoraCivil(isoStr) {
    if (!isoStr) return '-';
    const s = String(isoStr).trim();
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      const [, y, m, d, hh, mm] = match;
      return `${d}/${m}/${y}, ${hh}:${mm}`;
    }
    try {
      return new Date(s).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch (_) {
      return s;
    }
  }

  renderKpis(kpis) {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('kpi-ingresos-totales', this.formatCurrency(kpis.ingresos_totales));
    setText('kpi-ingresos-hoy', `Hoy: ${this.formatCurrency(kpis.ingresos_hoy)}`);
    setText('kpi-citas-hoy', String(kpis.citas_hoy ?? 0));

    const compHoy = kpis.citas_hoy_completadas ?? 0;
    const pendHoy = kpis.citas_hoy_pendientes ?? 0;
    const totHist = kpis.citas_totales ?? 0;
    setText(
      'kpi-citas-resumen',
      `${compHoy} completadas hoy · ${pendHoy} pendientes hoy (Histórico: ${totHist})`
    );
    setText('kpi-clientes-total', String(kpis.total_clientes ?? 0));
    setText('kpi-mascotas-total', `${kpis.total_mascotas ?? 0} mascotas registradas`);
    setText('kpi-alertas-stock', String(kpis.alertas_inventario ?? 0));
  }

  renderCharts(graficas) {
    if (typeof window.Chart === 'undefined') return;

    const metodosObj = graficas.ingresos_por_metodo || {};
    const metodosLabels = Object.keys(metodosObj);
    const metodosValues = Object.values(metodosObj);

    const ctxMetodos = document.getElementById('chart-ingresos-metodo');
    if (ctxMetodos) {
      if (this.chartMetodos) this.chartMetodos.destroy();
      this.chartMetodos = new window.Chart(ctxMetodos, {
        type: 'doughnut',
        data: {
          labels: metodosLabels.length ? metodosLabels : ['Sin movimientos'],
          datasets: [
            {
              data: metodosValues.length ? metodosValues : [1],
              backgroundColor: metodosValues.length
                ? ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
                : ['#e2e8f0'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
        },
      });
    }

    const serviciosObj = graficas.citas_por_servicio || {};
    const srvLabels = Object.keys(serviciosObj);
    const srvValues = Object.values(serviciosObj);

    const ctxServicios = document.getElementById('chart-citas-servicio');
    if (ctxServicios) {
      if (this.chartServicios) this.chartServicios.destroy();
      this.chartServicios = new window.Chart(ctxServicios, {
        type: 'bar',
        data: {
          labels: srvLabels.length ? srvLabels : ['Sin citas'],
          datasets: [
            {
              label: 'Citas por Servicio',
              data: srvValues.length ? srvValues : [0],
              backgroundColor: '#3b82f6',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
  }

  renderAlertasStock(alertas) {
    const container = document.getElementById('dashboard-alertas-stock');
    if (!container) return;

    if (!alertas.length) {
      container.innerHTML = `
        <div class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <i class="fa-solid fa-circle-check"></i>
          <span>Todo el inventario de la sucursal se encuentra en niveles óptimos.</span>
        </div>`;
      return;
    }

    container.innerHTML = alertas
      .map(
        (p) => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm">
          <div>
            <p class="font-semibold text-slate-800">${p.nombre}</p>
            <p class="text-xs text-slate-500">${p.categoria || 'Insumo'}</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            Stock: ${p.stock} / Min: ${p.stock_minimo}
          </span>
        </div>`
      )
      .join('');
  }

  renderProximasCitas(citas) {
    const tbody = document.getElementById('dashboard-proximas-citas');
    if (!tbody) return;

    if (!citas.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-6 text-center text-slate-400 text-sm">
            No hay citas registradas en esta sucursal.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = citas
      .slice(0, 6)
      .map((c) => {
        const fechaFmt = this.formatearFechaHoraCivil(c.fecha_hora);
        const badgeColor =
          String(c.estado).toLowerCase() === 'completada'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-blue-100 text-blue-700';
        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 text-xs font-medium text-slate-700">${fechaFmt}</td>
            <td class="py-2.5 px-3 text-sm font-semibold text-slate-800">${c.servicio || '-'}</td>
            <td class="py-2.5 px-3 text-xs text-slate-600">${c.estilista || 'Por asignar'}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}">
                ${c.estado || 'Programada'}
              </span>
            </td>
          </tr>`;
      })
      .join('');
  }
}
