/**
 * PawFlow Landing Page — Interactive Modules & Conversion Config
 * Pure Vanilla JavaScript (zero runtime dependencies).
 */

/* =========================================================================
   1. CONFIGURACIÓN PRINCIPAL (edita estos datos antes de publicar)
   ========================================================================= */
const SITE_CONFIG = {
  brandName: 'PawFlow',
  // Número de WhatsApp en formato internacional sin "+" ni espacios (ej. 5215512345678)
  whatsappNumber: '5215512345678',
  // Dominio base de los subdominios de clientes (ej. mi-estetica.pawflow.mx)
  portalDomain: 'pawflow.mx',
  // URL general de acceso al CRM si el cliente no recuerda su subdominio
  crmGeneralUrl: 'https://app.pawflow.mx',
  // Opcional: endpoint POST (Make, n8n, Formspree o tu API) para recibir solicitudes de demo
  demoWebhookUrl: '',
};

/* =========================================================================
   Helpers
   ========================================================================= */
function buildWhatsAppUrl(message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encoded}`;
}

function formatMXN(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

/* =========================================================================
   2. HEADER, MOBILE MENU & FLOATING WHATSAPP
   ========================================================================= */
function initNavigation() {
  const header = document.getElementById('site-header');
  const waFab = document.getElementById('wa-fab');
  const mobileToggle = document.getElementById('btn-mobile-menu');
  const mobileDrawer = document.getElementById('mobile-drawer');

  function onScroll() {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 16);
    waFab?.classList.toggle('is-visible', y > 360);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setDrawerOpen(open) {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.hidden = !open;
    mobileDrawer.classList.toggle('is-open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  mobileToggle?.addEventListener('click', () => {
    const isOpen = mobileDrawer?.classList.contains('is-open');
    setDrawerOpen(!isOpen);
  });

  document.querySelectorAll('[data-close-mobile]').forEach((el) => {
    el.addEventListener('click', () => setDrawerOpen(false));
  });

  // Inicializar enlaces directos de WhatsApp
  const waMessages = {
    hero: `Hola, me interesa conocer ${SITE_CONFIG.brandName} para mi estética canina. ¿Podemos agendar una demo?`,
    contact: `Hola, quiero información sobre planes y prueba gratis de 14 días en ${SITE_CONFIG.brandName}.`,
    footer: `Hola, me gustaría hablar con ventas sobre ${SITE_CONFIG.brandName}.`,
    floating: `Hola, estoy viendo la página de ${SITE_CONFIG.brandName} y tengo una consulta.`,
  };

  document.querySelectorAll('[data-whatsapp-link]').forEach((link) => {
    const ctx = link.getAttribute('data-wa-context') || 'hero';
    link.setAttribute('href', buildWhatsAppUrl(waMessages[ctx] || waMessages.hero));
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

/* =========================================================================
   3. INTERACTIVE PRODUCT TOUR (TABS + LIVE DEMOS)
   ========================================================================= */
function initProductTour() {
  const tabs = Array.from(document.querySelectorAll('[data-tour-tab]'));
  const panels = {
    agenda: document.getElementById('panel-agenda'),
    lealtad: document.getElementById('panel-lealtad'),
    caja: document.getElementById('panel-caja'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tour-tab');
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      Object.entries(panels).forEach(([key, panel]) => {
        panel?.classList.toggle('is-active', key === target);
      });
    });
  });

  initAgendaDemo();
  initLoyaltyDemo();
  initBranchDemo();
}

function initAgendaDemo() {
  const container = document.getElementById('demo-agenda-list');
  const feedback = document.getElementById('demo-agenda-feedback');
  const resetBtn = document.getElementById('btn-reset-agenda');
  const filterBtns = Array.from(document.querySelectorAll('[data-stylist]'));
  if (!container) return;

  const baseSlots = [
    {
      id: 'slot-1',
      time: '10:00',
      stylist: 'sofia',
      stylistName: 'Sofía R.',
      pet: 'Luna · Golden Retriever',
      service: 'Baño medicado + cepillado',
      type: 'confirmed',
      statusText: 'En servicio',
    },
    {
      id: 'slot-2',
      time: '11:00',
      stylist: 'carlos',
      stylistName: 'Carlos M.',
      pet: 'Bruno · Schnauzer Mini',
      service: 'Corte completo de raza',
      type: 'progress',
      statusText: 'Listo 12:15',
    },
    {
      id: 'slot-3',
      time: '12:00',
      stylist: 'sofia',
      stylistName: 'Sofía R.',
      pet: 'Espacio disponible',
      service: 'Duración 60 min · Sin traslapes',
      type: 'open',
      statusText: '+ Agendar',
    },
    {
      id: 'slot-4',
      time: '14:00',
      stylist: 'carlos',
      stylistName: 'Carlos M.',
      pet: 'Bloqueo de comida',
      service: 'Horario protegido automáticamente',
      type: 'break',
      statusText: 'Comida',
    },
    {
      id: 'slot-5',
      time: '15:00',
      stylist: 'carlos',
      stylistName: 'Carlos M.',
      pet: 'Espacio disponible',
      service: 'Duración 60 min · Sin traslapes',
      type: 'open',
      statusText: '+ Agendar',
    },
  ];

  let bookedIds = new Set();
  let currentStylist = 'all';

  function render() {
    const visible = baseSlots.filter(
      (slot) => currentStylist === 'all' || slot.stylist === currentStylist
    );

    container.innerHTML = visible
      .map((slot) => {
        const isNewBooked = bookedIds.has(slot.id);
        let slotClass = 'agenda-slot';
        let statusClass = 'agenda-status ';
        let petLabel = slot.pet;
        let serviceLabel = `${slot.service} · ${slot.stylistName}`;
        let badge = slot.statusText;

        if (isNewBooked) {
          slotClass += ' agenda-slot--booked-new';
          statusClass += 'agenda-status--confirmed';
          petLabel = 'Milo · Pomerania (Reserva demo)';
          serviceLabel = `Baño y estética · ${slot.stylistName}`;
          badge = 'Confirmada';
        } else if (slot.type === 'open') {
          slotClass += ' agenda-slot--open';
          statusClass += 'agenda-status--open';
        } else if (slot.type === 'break') {
          slotClass += ' agenda-slot--break';
          statusClass += 'agenda-status--break';
        } else if (slot.type === 'progress') {
          statusClass += 'agenda-status--progress';
        } else {
          statusClass += 'agenda-status--confirmed';
        }

        const interactiveAttrs =
          slot.type === 'open' && !isNewBooked
            ? `role="button" tabindex="0" data-book-slot="${slot.id}"`
            : '';

        return `
          <div class="${slotClass}" ${interactiveAttrs}>
            <span class="agenda-time">${slot.time}</span>
            <div class="agenda-info">
              <strong>${petLabel}</strong>
              <span>${serviceLabel}</span>
            </div>
            <span class="${statusClass}">${badge}</span>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('[data-book-slot]').forEach((el) => {
      const book = () => {
        const id = el.getAttribute('data-book-slot');
        if (!id) return;
        bookedIds.add(id);
        if (feedback) {
          feedback.textContent =
            'Cita confirmada al instante. El espacio quedó bloqueado para evitar traslapes.';
        }
        if (resetBtn) resetBtn.style.display = 'inline-block';
        render();
      };
      el.addEventListener('click', book);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          book();
        }
      });
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentStylist = btn.getAttribute('data-stylist') || 'all';
      filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
  });

  resetBtn?.addEventListener('click', () => {
    bookedIds = new Set();
    if (feedback) {
      feedback.textContent = 'Espacios libres calculados respetando comidas y citas activas.';
    }
    resetBtn.style.display = 'none';
    render();
  });

  render();
}

function initLoyaltyDemo() {
  const stampsWrap = document.getElementById('demo-loyalty-stamps');
  const msgEl = document.getElementById('demo-loyalty-msg');
  const scanBtn = document.getElementById('btn-scan-loyalty');
  if (!stampsWrap || !msgEl || !scanBtn) return;

  let visits = 4;

  function render() {
    stampsWrap.innerHTML = Array.from({ length: 5 }, (_, idx) => {
      const n = idx + 1;
      const filled = n <= visits;
      const isReward = visits === 5 && n === 5;
      const classes = ['stamp-dot'];
      if (isReward) classes.push('is-reward');
      else if (filled) classes.push('is-filled');
      return `<div class="${classes.join(' ')}" aria-label="Visita ${n}">${
        isReward ? '★' : filled ? '✓' : n
      }</div>`;
    }).join('');

    if (visits >= 5) {
      msgEl.innerHTML = '<strong>¡5 de 5 sellos!</strong> Baño gratis desbloqueado en caja';
      scanBtn.textContent = 'Canjear y reiniciar';
    } else {
      const remaining = 5 - visits;
      msgEl.innerHTML = `<strong>${visits} de 5 baños</strong> · Falta ${remaining} ${
        remaining === 1 ? 'visita' : 'visitas'
      } para premio`;
      scanBtn.textContent = 'Escanear visita (+1)';
    }
  }

  scanBtn.addEventListener('click', () => {
    visits = visits >= 5 ? 1 : visits + 1;
    render();
  });

  render();
}

function initBranchDemo() {
  const btns = Array.from(document.querySelectorAll('[data-branch]'));
  const revEl = document.getElementById('branch-rev');
  const ticketEl = document.getElementById('branch-ticket');
  const staffEl = document.getElementById('branch-staff');
  const alertEl = document.getElementById('branch-alert');
  if (!btns.length || !revEl || !ticketEl || !staffEl || !alertEl) return;

  const branches = {
    roma: {
      rev: '$8,460',
      ticket: '$470',
      staff: '4 activos',
      alert: '<strong>Stock bajo:</strong> Shampoo Hipoalergénico 1L (quedan 2 piezas)',
    },
    condesa: {
      rev: '$11,280',
      ticket: '$515',
      staff: '5 activos',
      alert: '<strong>Stock bajo:</strong> Bálsamo Desenredante 500ml (queda 1 pieza)',
    },
  };

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-branch') || 'roma';
      const data = branches[key];
      if (!data) return;
      btns.forEach((b) => b.classList.toggle('is-active', b === btn));
      revEl.textContent = data.rev;
      ticketEl.textContent = data.ticket;
      staffEl.textContent = data.staff;
      alertEl.innerHTML = `<span>${data.alert}</span><span>Reordenar</span>`;
    });
  });
}

/* =========================================================================
   4. ROI CALCULATOR
   ========================================================================= */
function initRoiCalculator() {
  const citasInput = document.getElementById('slider-citas');
  const ticketInput = document.getElementById('slider-ticket');
  const sucursalesInput = document.getElementById('slider-sucursales');

  const valCitas = document.getElementById('val-citas');
  const valTicket = document.getElementById('val-ticket');
  const valSucursales = document.getElementById('val-sucursales');

  const moneyEl = document.getElementById('roi-money');
  const hoursEl = document.getElementById('roi-hours');
  const returnEl = document.getElementById('roi-return');
  const planNameEl = document.getElementById('roi-plan-name');
  const ctaRoi = document.getElementById('cta-roi-demo');

  if (!citasInput || !ticketInput || !sucursalesInput) return;

  let recommendedPlanValue = 'Básico — $499/mes';
  let recommendedBranchSelect = '1 sucursal';

  function update() {
    const citas = Number(citasInput.value);
    const ticket = Number(ticketInput.value);
    const sucursales = Number(sucursalesInput.value);

    if (valCitas) valCitas.textContent = `${citas} citas`;
    if (valTicket) valTicket.textContent = `${formatMXN(ticket)} MXN`;
    if (valSucursales) {
      valSucursales.textContent = `${sucursales} ${sucursales === 1 ? 'sucursal' : 'sucursales'}`;
    }

    // Estimación conservadora: 26 días operativos/mes, 10% mejora por menos traslapes/faltas + recompra lealtad QR
    const monthlyVolume = citas * ticket * 26 * sucursales;
    const recovered = Math.round(monthlyVolume * 0.1);
    const hoursSaved = Math.round((citas * 0.08 + 0.1) * 26 * sucursales);

    let planPrice = 499;
    let planLabel = 'Básico ($499 MXN/mes)';
    recommendedPlanValue = 'Básico — $499/mes';
    recommendedBranchSelect = '1 sucursal';

    if (sucursales >= 6) {
      planPrice = 2499;
      planLabel = 'Enterprise ($2,499 MXN/mes)';
      recommendedPlanValue = 'Enterprise — $2,499/mes';
      recommendedBranchSelect = '6 o más sucursales';
    } else if (sucursales >= 2 || citas >= 16) {
      planPrice = 999;
      planLabel = 'Pro ($999 MXN/mes)';
      recommendedPlanValue = 'Pro — $999/mes';
      recommendedBranchSelect = sucursales >= 2 ? '2 a 5 sucursales' : '1 sucursal';
    }

    const multiple = Math.max(1, Math.round(recovered / planPrice));

    if (moneyEl) moneyEl.textContent = `${formatMXN(recovered)} MXN`;
    if (hoursEl) hoursEl.textContent = `${hoursSaved} hrs`;
    if (returnEl) returnEl.textContent = `${multiple}×`;
    if (planNameEl) planNameEl.textContent = planLabel;
  }

  [citasInput, ticketInput, sucursalesInput].forEach((el) => {
    el.addEventListener('input', update);
  });

  ctaRoi?.addEventListener('click', () => {
    const planSelect = document.getElementById('input-plan');
    const branchSelect = document.getElementById('input-sucursales');
    if (planSelect) planSelect.value = recommendedPlanValue;
    if (branchSelect) branchSelect.value = recommendedBranchSelect;
  });

  update();
}

/* =========================================================================
   5. PRICING TOGGLE & PLAN SELECTION
   ========================================================================= */
function initPricing() {
  const billingBtns = Array.from(document.querySelectorAll('[data-billing]'));
  const priceEls = Array.from(document.querySelectorAll('[data-price-monthly]'));
  const periodEls = Array.from(document.querySelectorAll('[data-period-text]'));

  billingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-billing');
      const isAnnual = mode === 'annual';

      billingBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      priceEls.forEach((el) => {
        el.textContent = isAnnual
          ? el.getAttribute('data-price-annual')
          : el.getAttribute('data-price-monthly');
      });
      periodEls.forEach((el) => {
        el.textContent = isAnnual ? 'MXN / mes (facturado anual)' : 'MXN / mes';
      });
    });
  });

  document.querySelectorAll('[data-select-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const plan = btn.getAttribute('data-select-plan');
      const select = document.getElementById('input-plan');
      const demoSection = document.getElementById('demo');
      const nombreInput = document.getElementById('input-nombre');

      if (select && plan) select.value = plan;
      demoSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => nombreInput?.focus({ preventScroll: true }), 450);
    });
  });
}

/* =========================================================================
   6. FAQ ACCORDION
   ========================================================================= */
function initFaq() {
  const items = Array.from(document.querySelectorAll('.faq-item'));

  items.forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    trigger?.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* =========================================================================
   7. DEMO / TRIAL FORM + WHATSAPP HANDOFF
   ========================================================================= */
function initDemoForm() {
  const form = document.getElementById('form-demo');
  const successBox = document.getElementById('demo-success');
  const summaryEl = document.getElementById('demo-success-summary');
  const confirmWaBtn = document.getElementById('btn-confirm-wa');
  const resetBtn = document.getElementById('btn-reset-form');
  if (!form || !successBox) return;

  function setError(fieldName, message) {
    const input = form.querySelector(`[name="${fieldName}"]`);
    const err = form.querySelector(`[data-error-for="${fieldName}"]`);
    input?.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
  }

  function validate(data) {
    let valid = true;
    ['nombre', 'estetica', 'whatsapp', 'email'].forEach((k) => setError(k, ''));

    if (!data.nombre || data.nombre.length < 2) {
      setError('nombre', 'Ingresa tu nombre.');
      valid = false;
    }
    if (!data.estetica || data.estetica.length < 2) {
      setError('estetica', 'Ingresa el nombre de tu estética.');
      valid = false;
    }
    const digits = data.whatsapp.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('whatsapp', 'Ingresa un número de WhatsApp válido (mín. 10 dígitos).');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setError('email', 'Ingresa un correo electrónico válido.');
      valid = false;
    }
    return valid;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const data = {
      nombre: String(fd.get('nombre') || '').trim(),
      estetica: String(fd.get('estetica') || '').trim(),
      whatsapp: String(fd.get('whatsapp') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      sucursales: String(fd.get('sucursales') || '1 sucursal'),
      plan: String(fd.get('plan') || 'Pro — $999/mes'),
      createdAt: new Date().toISOString(),
    };

    if (!validate(data)) return;

    // Guardar respaldo local y enviar a webhook si está configurado
    try {
      localStorage.setItem('pawflow_last_demo_request', JSON.stringify(data));
      if (SITE_CONFIG.demoWebhookUrl) {
        await fetch(SITE_CONFIG.demoWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    } catch {
      // No bloquear la confirmación al usuario si falla el webhook opcional
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div><strong>Contacto:</strong> ${escapeHtml(data.nombre)}</div>
        <div><strong>Estética:</strong> ${escapeHtml(data.estetica)} (${escapeHtml(data.sucursales)})</div>
        <div><strong>Plan de interés:</strong> ${escapeHtml(data.plan)}</div>
        <div><strong>WhatsApp / Correo:</strong> ${escapeHtml(data.whatsapp)} · ${escapeHtml(data.email)}</div>
      `;
    }

    const waText = [
      `Hola equipo ${SITE_CONFIG.brandName}, solicité una demo y prueba gratis de 14 días:`,
      `• Nombre: ${data.nombre}`,
      `• Estética: ${data.estetica}`,
      `• Sucursales: ${data.sucursales}`,
      `• Plan de interés: ${data.plan}`,
      `• Correo: ${data.email}`,
    ].join('\n');

    confirmWaBtn?.setAttribute('href', buildWhatsAppUrl(waText));

    form.hidden = true;
    successBox.classList.add('is-visible');
  });

  resetBtn?.addEventListener('click', () => {
    successBox.classList.remove('is-visible');
    form.hidden = false;
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================================
   8. CLIENT PORTAL LOGIN MODAL (SUBDOMAIN ACCESS)
   ========================================================================= */
function initPortalModal() {
  const modal = document.getElementById('modal-login');
  const closeBtn = document.getElementById('btn-close-login');
  const form = document.getElementById('form-portal-login');
  const input = document.getElementById('input-subdomain');
  const suffixEl = document.getElementById('portal-domain-suffix');
  const directLink = document.getElementById('link-direct-crm');

  if (!modal) return;

  const isMountedWithCrm = window.location.pathname.startsWith('/landing');
  if (suffixEl) suffixEl.textContent = `.${SITE_CONFIG.portalDomain}`;
  if (directLink) {
    directLink.setAttribute('href', isMountedWithCrm ? '/' : SITE_CONFIG.crmGeneralUrl);
    if (isMountedWithCrm) directLink.removeAttribute('target');
  }

  function openModal() {
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => input?.focus(), 60);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-open-login]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = (input?.value || '').trim().toLowerCase();
    const clean = raw.replace(/[^a-z0-9-]/g, '');
    if (!clean) {
      input?.focus();
      return;
    }
    if (isMountedWithCrm) {
      window.location.href = `/?tenant=${encodeURIComponent(clean)}`;
    } else {
      window.location.href = `https://${clean}.${SITE_CONFIG.portalDomain}`;
    }
  });
}

/* =========================================================================
   9. LIGHT & SHADE–INSPIRED MOTION ENGINE
   ========================================================================= */
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initStudioClock() {
  const el = document.getElementById('studio-live-clock');
  if (!el) return;

  const updateClock = () => {
    try {
      const now = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
      el.textContent = `${now} hrs`;
    } catch {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      el.textContent = `${hh}:${mm} hrs`;
    }
  };

  updateClock();
  window.setInterval(updateClock, 15000);
}

function initSplitText() {
  if (prefersReducedMotion()) return;

  document.querySelectorAll('[data-split]').forEach((heading) => {
    const rawText = heading.textContent.replace(/\s+/g, ' ').trim();
    heading.setAttribute('aria-label', rawText);

    let charIndex = 0;

    const splitNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        const tokens = (node.textContent || '').split(/(\s+)/);

        tokens.forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(' '));
            return;
          }
          const wordSpan = document.createElement('span');
          wordSpan.className = 'split-word';
          wordSpan.setAttribute('aria-hidden', 'true');

          Array.from(token).forEach((ch) => {
            const charSpan = document.createElement('span');
            charSpan.className = 'split-char';
            charSpan.style.setProperty('--char-i', String(Math.min(charIndex++, 36)));
            charSpan.textContent = ch;
            wordSpan.appendChild(charSpan);
          });

          frag.appendChild(wordSpan);
        });

        return frag;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        Array.from(node.childNodes).forEach((child) => {
          clone.appendChild(splitNode(child));
        });
        return clone;
      }

      return document.createDocumentFragment();
    };

    const nextFrag = document.createDocumentFragment();
    Array.from(heading.childNodes).forEach((child) => {
      nextFrag.appendChild(splitNode(child));
    });

    heading.textContent = '';
    heading.appendChild(nextFrag);
  });
}

function initRollLinks() {
  if (prefersReducedMotion()) return;

  document.querySelectorAll('[data-roll]').forEach((el) => {
    const text = el.textContent.trim();
    if (!text) return;
    el.classList.add('roll-link');
    el.innerHTML = `
      <span class="roll-link__track" aria-hidden="true">
        <span class="roll-link__copy">${escapeHtml(text)}</span>
        <span class="roll-link__copy roll-link__copy--clone">${escapeHtml(text)}</span>
      </span>
      <span class="sr-only">${escapeHtml(text)}</span>
    `;
  });
}

function initScrollProgressAndParallax() {
  const bar = document.getElementById('scroll-progress-bar');
  const parallaxFrames = Array.from(document.querySelectorAll('[data-parallax]'));
  const reduced = prefersReducedMotion();

  let ticking = false;

  const update = () => {
    ticking = false;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (bar && docH > 0) {
      const progress = Math.min(1, Math.max(0, window.scrollY / docH));
      bar.style.transform = `scaleX(${progress})`;
    }

    if (reduced) return;

    const vh = window.innerHeight;
    parallaxFrames.forEach((frame) => {
      const rect = frame.getBoundingClientRect();
      if (rect.bottom < -60 || rect.top > vh + 60) return;
      const strength = Number(frame.getAttribute('data-parallax')) || 20;
      const ratio = (rect.top + rect.height * 0.5 - vh * 0.5) / (vh * 0.5);
      const shift = Math.max(-strength, Math.min(strength, ratio * -strength));
      frame.style.setProperty('--parallax-y', `${shift.toFixed(1)}px`);
    });
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

function initEditorialCursorAndMagnetics() {
  const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer || prefersReducedMotion()) return;

  // 1. Dark-surface Light & Shade cursor spotlight
  document.querySelectorAll('[data-spotlight]').forEach((surface) => {
    surface.addEventListener('pointermove', (e) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      surface.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  // 2. Magnetic pull on key CTA pills
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
      btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });

  // 3. Lerp-smoothed Editorial Cursor Lens
  const lens = document.getElementById('cursor-lens');
  const labelEl = document.getElementById('cursor-lens-label');
  if (!lens || !labelEl) return;

  let tx = -120;
  let ty = -120;
  let cx = -120;
  let cy = -120;
  let rafId = 0;

  const animate = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    lens.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -50%)`;
    if (Math.abs(tx - cx) > 0.2 || Math.abs(ty - cy) > 0.2) {
      rafId = window.requestAnimationFrame(animate);
    } else {
      rafId = 0;
    }
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      lens.classList.add('is-visible');
      if (!rafId) rafId = window.requestAnimationFrame(animate);
    },
    { passive: true }
  );

  document.addEventListener('pointerleave', () => {
    lens.classList.remove('is-visible', 'is-active', 'is-wa');
  });

  document.querySelectorAll('[data-cursor]').forEach((target) => {
    target.addEventListener('pointerenter', () => {
      const text = target.getAttribute('data-cursor') || '';
      const tone = target.getAttribute('data-cursor-tone') || '';
      labelEl.textContent = text;
      lens.classList.add('is-active');
      lens.classList.toggle('is-wa', tone === 'wa');
    });
    target.addEventListener('pointerleave', () => {
      lens.classList.remove('is-active', 'is-wa');
      labelEl.textContent = '';
    });
  });
}

function initCountUpStats() {
  const nums = Array.from(document.querySelectorAll('[data-count-to]'));
  if (!nums.length || prefersReducedMotion()) return;

  const runCount = (el) => {
    if (el.dataset.counted === '1') return;
    el.dataset.counted = '1';
    const target = Number(el.getAttribute('data-count-to')) || 0;
    const suffix = el.getAttribute('data-count-suffix') || '';
    if (target === 0) {
      el.textContent = `0${suffix}`;
      return;
    }
    const duration = 950;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(eased * target);
      el.textContent = `${val}${suffix}`;
      if (t < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) {
    nums.forEach(runCount);
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  nums.forEach((el) => obs.observe(el));
}

/* =========================================================================
   10. SCROLL REVEAL ANIMATIONS (REVEAL + SPLIT HEADINGS + CURTAIN PHOTOS)
   ========================================================================= */
function initReveal() {
  const els = Array.from(document.querySelectorAll('.reveal, [data-split], .curtain-frame'));
  if (!els.length) return;

  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  document.documentElement.classList.add('has-reveal');

  const revealVisible = () => {
    const cutoff = window.innerHeight + 80;
    els.forEach((el) => {
      if (el.classList.contains('is-in')) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= cutoff) {
        el.classList.add('is-in');
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px 80px 0px' }
  );

  els.forEach((el) => observer.observe(el));
  window.addEventListener('scroll', revealVisible, { passive: true });
  window.addEventListener('hashchange', revealVisible);
  window.requestAnimationFrame(revealVisible);
}

/* =========================================================================
   Bootstrap
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initStudioClock();
  initSplitText();
  initRollLinks();
  initProductTour();
  initRoiCalculator();
  initPricing();
  initFaq();
  initDemoForm();
  initPortalModal();
  initScrollProgressAndParallax();
  initEditorialCursorAndMagnetics();
  initCountUpStats();
  initReveal();
});

