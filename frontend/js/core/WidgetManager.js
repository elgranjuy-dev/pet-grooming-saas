/**
 * WidgetManager.js
 * Gestiona el comportamiento interactivo de todos los bloques/cajas (.module-widget)
 * en todos los módulos del sistema:
 * 1. Minimizar / Expandir cualquier caja dentro del módulo (sin botón de cerrar).
 * 2. Arrastrar y soltar (Drag & Drop) para ordenar las cajas como el usuario prefiera.
 * 3. Persistencia automática en localStorage (orden de cajas y estado minimizado).
 */
export class WidgetManager {
  static STORAGE_KEY = 'pet_grooming_widgets_layout_v1';

  constructor(notify = null) {
    this.notify = notify;
    this.draggedWidget = null;
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
  }

  enhanceWidgetHeader(widget, widgetId) {
    const header = widget.querySelector('.widget-header');
    if (!header || header.dataset.enhanced === 'true') return;
    header.dataset.enhanced = 'true';

    // Asegurar que exista el ícono de arrastre (grip) al inicio del título
    const titleEl = header.querySelector('.widget-title') || header.querySelector('h3');
    if (titleEl && !header.querySelector('.widget-drag-handle')) {
      const handle = document.createElement('span');
      handle.className =
        'widget-drag-handle cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 mr-2 inline-flex items-center select-none';
      handle.title = 'Arrastra desde aquí para mover y ordenar este bloque';
      handle.innerHTML = `<i class="fa-solid fa-grip-vertical text-xs"></i>`;
      titleEl.prepend(handle);
    }

    // Contenedor derecho de acciones de la cabecera (controles existentes + botón minimizar)
    let actionsWrap = header.querySelector('.widget-actions');
    if (!actionsWrap) {
      actionsWrap = document.createElement('div');
      actionsWrap.className = 'widget-actions flex items-center gap-1.5 shrink-0 ml-auto';
      header.appendChild(actionsWrap);
    }

    // Botón Minimizar / Expandir (sin opción de cerrar bloque)
    if (!actionsWrap.querySelector('.widget-minimize-btn')) {
      const minBtn = document.createElement('button');
      minBtn.type = 'button';
      minBtn.className =
        'widget-minimize-btn w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition shrink-0';
      minBtn.title = 'Minimizar / Expandir bloque';
      minBtn.innerHTML = `<i class="fa-solid fa-minus text-xs"></i>`;

      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMin = widget.classList.contains('widget-minimized');
        this.setWidgetMinimized(widget, widgetId, !isMin, true);
      });

      actionsWrap.appendChild(minBtn);
    }

    // Activar draggable únicamente cuando el usuario presiona en la cabecera o en el grip
    // (evita que inputs, selects o botones dentro del bloque activen el arrastre por error)
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, select, textarea, button, a, label')) {
        widget.setAttribute('draggable', 'false');
        return;
      }
      widget.setAttribute('draggable', 'true');
    });

    header.addEventListener('mouseup', () => {
      widget.setAttribute('draggable', 'false');
    });
  }

  setWidgetMinimized(widget, widgetId, minimized, persist = true) {
    widget.classList.toggle('widget-minimized', minimized);
    const icon = widget.querySelector('.widget-minimize-btn i');
    const btn = widget.querySelector('.widget-minimize-btn');

    if (icon) {
      icon.className = minimized
        ? 'fa-solid fa-chevron-down text-xs'
        : 'fa-solid fa-minus text-xs';
    }
    if (btn) {
      btn.title = minimized ? 'Expandir bloque' : 'Minimizar bloque';
    }

    if (persist && widgetId) {
      this.state.minimized[widgetId] = minimized;
      this.saveState();
    }
  }

  bindGridDragEvents(grid, gridId) {
    grid.addEventListener('dragstart', (e) => {
      const widget = e.target.closest('.module-widget[data-widget-id]');
      if (!widget || widget.parentElement !== grid) return;

      this.draggedWidget = widget;
      widget.classList.add('widget-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', widget.getAttribute('data-widget-id') || '');
      }
    });

    grid.addEventListener('dragend', () => {
      if (this.draggedWidget) {
        this.draggedWidget.classList.remove('widget-dragging');
        this.draggedWidget.setAttribute('draggable', 'false');
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
      e.preventDefault();
      if (!this.draggedWidget || this.draggedWidget.parentElement !== grid) return;

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
      const insertAfter = e.clientY > midpointY || (Math.abs(e.clientY - midpointY) < 40 && e.clientX > midpointX);

      if (insertAfter) {
        grid.insertBefore(this.draggedWidget, targetWidget.nextSibling);
      } else {
        grid.insertBefore(this.draggedWidget, targetWidget);
      }
    });

    grid.addEventListener('drop', (e) => {
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
    const ids = Array.from(grid.querySelectorAll(':scope > .module-widget[data-widget-id]')).map(
      (el) => el.getAttribute('data-widget-id')
    );
    this.state.order[gridId] = ids;
    this.saveState();
  }

  restoreGridOrder(grid, gridId) {
    const savedIds = this.state.order[gridId];
    if (!Array.isArray(savedIds) || !savedIds.length) return;

    const map = {};
    Array.from(grid.querySelectorAll(':scope > .module-widget[data-widget-id]')).forEach((el) => {
      map[el.getAttribute('data-widget-id')] = el;
    });

    savedIds.forEach((id) => {
      if (map[id]) {
        grid.appendChild(map[id]);
      }
    });
  }
}
