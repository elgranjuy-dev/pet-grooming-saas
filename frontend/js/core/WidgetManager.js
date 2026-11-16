/**
 * WidgetManager.js
 * Gestiona el comportamiento interactivo de todas las cajas/bloques (.module-widget)
 * en todos los módulos del sistema:
 * 1. Minimizar / Expandir cualquier caja dentro del módulo (sin botón de cerrar).
 * 2. Maximizar cualquier caja a Pantalla Completa / Restaurar tamaño normal.
 * 3. Arrastrar y soltar (Drag & Drop) desde la cabecera o ícono (⠿) para ordenar las cajas.
 * 4. Persistencia automática en localStorage (orden de cajas y estado minimizado).
 */
export class WidgetManager {
  static STORAGE_KEY = 'pet_grooming_widgets_layout_v1';

  constructor(notify = null) {
    this.notify = notify;
    this.draggedWidget = null;
    this.maximizedWidget = null;
    this.backdropEl = null;
    this.state = this.loadState();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(WidgetManager.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        minimized: parsed.minimized || {},
        order: parsed.order || {},
      };
    } catch (_) {
      return { minimized: {}, order: {} };
    }
  }

  saveState() {
    try {
      localStorage.setItem(WidgetManager.STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  init() {
    this.ensureBackdropElement();

    const grids = document.querySelectorAll('.module-widgets-grid');
    grids.forEach((grid) => {
      const gridId = grid.getAttribute('data-grid-id');
      if (gridId) {
        this.restoreGridOrder(grid, gridId);
      }
      this.bindGridDragEvents(grid, gridId);
    });

    const widgets = document.querySelectorAll('.module-widget[data-widget-id]');
    widgets.forEach((widget) => {
      const widgetId = widget.getAttribute('data-widget-id');
      this.enhanceWidgetHeader(widget, widgetId);
      if (this.state.minimized[widgetId]) {
        this.setWidgetMinimized(widget, widgetId, true, false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.maximizedWidget) {
        this.setWidgetMaximized(this.maximizedWidget, false);
      }
    });
  }

  ensureBackdropElement() {
    let backdrop = document.getElementById('widget-fullscreen-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'widget-fullscreen-backdrop';
      backdrop.className = 'hidden fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-40 transition-opacity';
      backdrop.title = 'Haz clic o presiona ESC para salir de pantalla completa';
      backdrop.addEventListener('click', () => {
        if (this.maximizedWidget) {
          this.setWidgetMaximized(this.maximizedWidget, false);
        }
      });
      document.body.appendChild(backdrop);
    }
    this.backdropEl = backdrop;
  }

  enhanceWidgetHeader(widget, widgetId) {
    const header = widget.querySelector('.widget-header');
    if (!header) return;

    // Habilitar arrastre nativo directamente en la cabecera para compatibilidad total con Safari/Chrome macOS
    header.setAttribute('draggable', 'true');
    header.classList.add('cursor-grab', 'active:cursor-grabbing', 'select-none');

    // 1. Asegurar que exista el ícono de arrastre (grip) al inicio del título
    const titleEl = header.querySelector('.widget-title') || header.querySelector('h3');
    if (titleEl && !header.querySelector('.widget-drag-handle')) {
      const handle = document.createElement('span');
      handle.className =
        'widget-drag-handle w-6 h-6 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-400 hover:text-blue-600 mr-2 inline-flex items-center justify-center transition shrink-0';
      handle.title = 'Arrastra desde aquí para mover y ordenar este bloque';
      handle.innerHTML = `<i class="fa-solid fa-grip-vertical text-xs"></i>`;
      titleEl.prepend(handle);
    }

    // 2. Contenedor derecho de acciones de la cabecera
    let actionsWrap = header.querySelector('.widget-actions');
    if (!actionsWrap) {
      actionsWrap = document.createElement('div');
      actionsWrap.className = 'widget-actions flex items-center gap-1.5 shrink-0 ml-auto';
      header.appendChild(actionsWrap);
    }

    // 3. Contenedor de botones de ventana (Minimizar y Maximizar Pantalla Completa; sin botón cerrar)
    let windowBtns = actionsWrap.querySelector('.widget-window-controls');
    if (!windowBtns) {
      windowBtns = document.createElement('div');
      windowBtns.className = 'widget-window-controls flex items-center gap-1 pl-1';
      actionsWrap.appendChild(windowBtns);
    }

    // Botón Minimizar / Desplegar (- / +)
    let minBtn = windowBtns.querySelector('.widget-minimize-btn');
    if (!minBtn) {
      minBtn = document.createElement('button');
      minBtn.type = 'button';
      minBtn.draggable = false;
      minBtn.className =
        'widget-minimize-btn w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 border border-slate-200/80 flex items-center justify-center transition shrink-0';
      minBtn.title = 'Minimizar bloque';
      minBtn.innerHTML = `<i class="fa-solid fa-minus text-xs pointer-events-none"></i>`;
      windowBtns.appendChild(minBtn);
    }

    if (!minBtn.dataset.bound) {
      minBtn.dataset.bound = 'true';
      minBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isMin = widget.classList.contains('widget-minimized');
        if (!isMin && widget.classList.contains('widget-maximized')) {
          this.setWidgetMaximized(widget, false);
        }
        this.setWidgetMinimized(widget, widgetId, !isMin, true);
      });
    }

    // Botón Maximizar a Pantalla Completa / Restaurar
    let maxBtn = windowBtns.querySelector('.widget-maximize-btn');
    if (!maxBtn) {
      maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.draggable = false;
      maxBtn.className =
        'widget-maximize-btn w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 border border-slate-200/80 flex items-center justify-center transition shrink-0';
      maxBtn.title = 'Maximizar bloque a pantalla completa';
      maxBtn.innerHTML = `<i class="fa-solid fa-expand text-xs pointer-events-none"></i>`;
      windowBtns.appendChild(maxBtn);
    }

    if (!maxBtn.dataset.bound) {
      maxBtn.dataset.bound = 'true';
      maxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isMax = widget.classList.contains('widget-maximized');
        this.setWidgetMaximized(widget, !isMax, widgetId);
      });
    }

    // Doble clic en la barra de título también alterna minimizar/expandir rápidamente
    if (!header.dataset.dblBound) {
      header.dataset.dblBound = 'true';
      header.addEventListener('dblclick', (e) => {
        if (e.target.closest('input, select, textarea, button, a, label')) return;
        const isMin = widget.classList.contains('widget-minimized');
        this.setWidgetMinimized(widget, widgetId, !isMin, true);
      });
    }
  }

  setWidgetMinimized(widget, widgetId, minimized, persist = true) {
    widget.classList.toggle('widget-minimized', minimized);
    const icon = widget.querySelector('.widget-minimize-btn i');
    const btn = widget.querySelector('.widget-minimize-btn');

    if (icon) {
      icon.className = minimized
        ? 'fa-solid fa-plus text-xs pointer-events-none'
        : 'fa-solid fa-minus text-xs pointer-events-none';
    }
    if (btn) {
      btn.title = minimized ? 'Expandir bloque' : 'Minimizar bloque';
      btn.classList.toggle('bg-blue-600', minimized);
      btn.classList.toggle('text-white', minimized);
      btn.classList.toggle('bg-slate-100', !minimized);
      btn.classList.toggle('text-slate-600', !minimized);
    }

    if (persist && widgetId) {
      this.state.minimized[widgetId] = minimized;
      this.saveState();
    }
  }

  setWidgetMaximized(widget, maximized, widgetId = null) {
    const resolvedId = widgetId || widget.getAttribute('data-widget-id');

    // Si había otro widget maximizado, restaurarlo primero
    if (maximized && this.maximizedWidget && this.maximizedWidget !== widget) {
      this.setWidgetMaximized(this.maximizedWidget, false);
    }

    // Si se maximiza estando minimizado, desplegar su contenido automáticamente
    if (maximized && widget.classList.contains('widget-minimized')) {
      this.setWidgetMinimized(widget, resolvedId, false, true);
    }

    widget.classList.toggle('widget-maximized', maximized);
    const header = widget.querySelector('.widget-header');
    if (header) {
      header.setAttribute('draggable', maximized ? 'false' : 'true');
    }

    const icon = widget.querySelector('.widget-maximize-btn i');
    const btn = widget.querySelector('.widget-maximize-btn');

    if (icon) {
      icon.className = maximized
        ? 'fa-solid fa-compress text-xs pointer-events-none'
        : 'fa-solid fa-expand text-xs pointer-events-none';
    }
    if (btn) {
      btn.title = maximized
        ? 'Restaurar tamaño normal (ESC)'
        : 'Maximizar bloque a pantalla completa';
      btn.classList.toggle('bg-indigo-600', maximized);
      btn.classList.toggle('text-white', maximized);
      btn.classList.toggle('bg-slate-100', !maximized);
      btn.classList.toggle('text-slate-600', !maximized);
    }

    if (this.backdropEl) {
      this.backdropEl.classList.toggle('hidden', !maximized);
    }

    this.maximizedWidget = maximized ? widget : null;

    // Redimensionar gráficas (Chart.js) si el bloque contiene un canvas
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  bindGridDragEvents(grid, gridId) {
    grid.addEventListener('dragstart', (e) => {
      // No iniciar arrastre si el clic fue sobre un botón, input o selector
      if (e.target.closest('button, input, select, textarea, a, label')) {
        e.preventDefault();
        return;
      }

      const header = e.target.closest('.widget-header');
      const widget = e.target.closest('.module-widget[data-widget-id]');
      if (!header || !widget || widget.parentElement !== grid) {
        e.preventDefault();
        return;
      }

      if (widget.classList.contains('widget-maximized')) {
        e.preventDefault();
        return;
      }

      this.draggedWidget = widget;
      widget.classList.add('widget-dragging');

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', widget.getAttribute('data-widget-id') || 'widget');
        try {
          e.dataTransfer.setDragImage(widget, 28, 20);
        } catch (_) {}
      }
    });

    grid.addEventListener('dragend', () => {
      if (this.draggedWidget) {
        this.draggedWidget.classList.remove('widget-dragging');
      }
      grid.querySelectorAll('.widget-drop-target').forEach((el) => {
        el.classList.remove('widget-drop-target');
      });
      this.draggedWidget = null;
      if (gridId) {
        this.saveGridOrder(grid, gridId);
      }
    });

    grid.addEventListener('dragover', (e) => {
      if (!this.draggedWidget || this.draggedWidget.parentElement !== grid) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const targetWidget = e.target.closest('.module-widget[data-widget-id]');
      grid.querySelectorAll('.widget-drop-target').forEach((el) => {
        if (el !== targetWidget) el.classList.remove('widget-drop-target');
      });

      if (!targetWidget || targetWidget === this.draggedWidget || targetWidget.parentElement !== grid) {
        return;
      }

      targetWidget.classList.add('widget-drop-target');

      const rect = targetWidget.getBoundingClientRect();
      const midpointY = rect.top + rect.height / 2;
      const midpointX = rect.left + rect.width / 2;
      const insertAfter =
        e.clientY > midpointY ||
        (Math.abs(e.clientY - midpointY) < 45 && e.clientX > midpointX);

      if (insertAfter) {
        grid.insertBefore(this.draggedWidget, targetWidget.nextSibling);
      } else {
        grid.insertBefore(this.draggedWidget, targetWidget);
      }
    });

    grid.addEventListener('drop', (e) => {
      if (!this.draggedWidget || this.draggedWidget.parentElement !== grid) return;
      e.preventDefault();
      grid.querySelectorAll('.widget-drop-target').forEach((el) => {
        el.classList.remove('widget-drop-target');
      });
      if (gridId) {
        this.saveGridOrder(grid, gridId);
      }
    });
  }

  saveGridOrder(grid, gridId) {
    const ids = Array.from(
      grid.querySelectorAll(':scope > .module-widget[data-widget-id]')
    ).map((el) => el.getAttribute('data-widget-id'));
    this.state.order[gridId] = ids;
    this.saveState();
  }

  restoreGridOrder(grid, gridId) {
    const savedIds = this.state.order[gridId];
    if (!Array.isArray(savedIds) || !savedIds.length) return;

    const map = {};
    Array.from(
      grid.querySelectorAll(':scope > .module-widget[data-widget-id]')
    ).forEach((el) => {
      map[el.getAttribute('data-widget-id')] = el;
    });

    savedIds.forEach((id) => {
      if (map[id]) {
        grid.appendChild(map[id]);
      }
    });
  }
}
