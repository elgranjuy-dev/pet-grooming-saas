/**
 * PawFlow Landing Page — Blue Heeler × Kern Society Interactive Engine
 * Pure Vanilla JavaScript (zero runtime dependencies).
 */

/* =========================================================================
   1. CONFIGURACIÓN PRINCIPAL (edita estos datos antes de publicar)
   ========================================================================= */
const SITE_CONFIG = {
  brandName: 'PawFlow',
  whatsappNumber: '5215512345678',
  portalDomain: 'pawflow.mx',
  crmGeneralUrl: 'https://app.pawflow.mx',
  demoWebhookUrl: '',
};

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildWhatsAppUrl(message) {
  return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function formatMXN(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

function slugify(str) {
  return (str || 'mi-estetica')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mi-estetica';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================================
   2. NAVIGATION, MOBILE DRAWER & WHATSAPP LINKS
   ========================================================================= */
function initNavigation() {
  const waFab = document.getElementById('wa-fab');
  const mobileToggle = document.getElementById('btn-mobile-menu');
  const mobileDrawer = document.getElementById('mobile-drawer');

  const onScroll = () => {
    waFab?.classList.toggle('is-visible', window.scrollY > 380);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setDrawer = (open) => {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.hidden = !open;
    mobileDrawer.classList.toggle('is-open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
  };

  mobileToggle?.addEventListener('click', () => {
    setDrawer(!mobileDrawer?.classList.contains('is-open'));
  });
  document.querySelectorAll('[data-close-mobile]').forEach((el) => {
    el.addEventListener('click', () => setDrawer(false));
  });

  const waMessages = {
    hero: `Hola, me interesa probar ${SITE_CONFIG.brandName} en mi estética canina. ¿Podemos agendar una demo?`,
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
   3. KERN SOCIETY SIGNATURE: PROXIMITY VARIABLE-FONT WORDMARK
   ========================================================================= */
function initKineticWordmark() {
  const wrap = document.getElementById('kinetic-wordmark');
  if (!wrap || prefersReducedMotion()) return;
  const chars = Array.from(wrap.querySelectorAll('.kw-char'));
  if (!chars.length) return;

  const rest = () => {
    chars.forEach((ch) => {
      ch.style.fontVariationSettings = `'wght' 900, 'wdth' 145, 'slnt' 0`;
    });
  };

  rest();

  const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer) {
    wrap.addEventListener('pointermove', (e) => {
      const mx = e.clientX;
      const my = e.clientY;
      chars.forEach((ch) => {
        const rect = ch.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const dist = Math.hypot(mx - cx, my - cy);
        const radius = Math.max(260, rect.width * 2.6);
        const proximity = Math.max(0, 1 - dist / radius);
        const eased = proximity * proximity;

        // Gruesas y anchas en reposo (900 / 145), adelgazan dramáticamente al acercar el cursor (150 / 75)
        const wght = Math.round(900 - eased * 750);
        const wdth = Math.round(145 - eased * 70);
        const slnt = (-eased * 7).toFixed(1);
        ch.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'slnt' ${slnt}`;
      });
    });

    wrap.addEventListener('pointerleave', rest);
  } else {
    // On mobile/touch: wave thinning driven by scroll
    window.addEventListener(
      'scroll',
      () => {
        const phase = window.scrollY * 0.025;
        chars.forEach((ch, idx) => {
          const wave = (Math.sin(phase + idx * 0.75) + 1) * 0.5;
          const wght = Math.round(900 - wave * 640);
          const wdth = Math.round(145 - wave * 58);
          ch.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'slnt' 0`;
        });
      },
      { passive: true }
    );
  }
}

/* =========================================================================
   4. (02) LIVE TEST DRIVE SANDBOX (CUSTOM SALON NAME + CRM DEMOS)
   ========================================================================= */
function initTestDriveSandbox() {
  const input = document.getElementById('sandbox-salon-input');
  const urlEl = document.getElementById('sandbox-subdomain-url');
  const loyaltyTitle = document.getElementById('loyalty-salon-title');
  const branchSalon = document.getElementById('branch-salon-name');
  const heroShort = document.querySelector('[data-live-salon-short]');
  const presetBtns = Array.from(document.querySelectorAll('[data-salon-preset]'));
  const formSalonInput = document.getElementById('input-estetica');

  const syncSalonName = (rawName) => {
    const cleanName = (rawName || '').trim() || 'Blue Paws Roma';
    const slug = slugify(cleanName);
    if (urlEl) urlEl.textContent = `https://${slug}.${SITE_CONFIG.portalDomain}`;
    if (loyaltyTitle) loyaltyTitle.textContent = cleanName;
    if (branchSalon) branchSalon.textContent = cleanName;
    if (heroShort) heroShort.textContent = cleanName;
    if (formSalonInput && !formSalonInput.dataset.userEdited) {
      formSalonInput.value = cleanName;
    }
  };

  formSalonInput?.addEventListener('input', () => {
    formSalonInput.dataset.userEdited = '1';
  });

  input?.addEventListener('input', () => {
    syncSalonName(input.value);
    presetBtns.forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-salon-preset') === input.value.trim());
    });
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-salon-preset') || 'Blue Paws Roma';
      if (input) input.value = val;
      presetBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      syncSalonName(val);
    });
  });

  syncSalonName(input?.value || 'Blue Paws Roma');
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
    { id: 'slot-1', time: '10:00', stylist: 'sofia', stylistName: 'Sofía R.', pet: 'Blue · Blue Heeler', service: 'Deslanado + baño neutro', type: 'confirmed', statusText: 'En servicio' },
    { id: 'slot-2', time: '11:00', stylist: 'carlos', stylistName: 'Carlos M.', pet: 'Bruno · Schnauzer Mini', service: 'Corte completo de raza', type: 'progress', statusText: 'Listo 12:15' },
    { id: 'slot-3', time: '12:00', stylist: 'sofia', stylistName: 'Sofía R.', pet: 'Espacio disponible', service: '60 min · Sin traslapes', type: 'open', statusText: '+ Agendar' },
    { id: 'slot-4', time: '14:00', stylist: 'carlos', stylistName: 'Carlos M.', pet: 'Bloqueo de comida', service: 'Horario protegido', type: 'break', statusText: 'Comida' },
    { id: 'slot-5', time: '15:00', stylist: 'carlos', stylistName: 'Carlos M.', pet: 'Espacio disponible', service: '60 min · Sin traslapes', type: 'open', statusText: '+ Agendar' },
  ];

  let bookedIds = new Set();
  let currentStylist = 'all';

  function render() {
    const visible = baseSlots.filter((s) => currentStylist === 'all' || s.stylist === currentStylist);
    container.innerHTML = visible
      .map((slot) => {
        const isNew = bookedIds.has(slot.id);
        let slotClass = 'agenda-slot';
        let statusClass = 'agenda-status ';
        let petLabel = slot.pet;
        let serviceLabel = `${slot.service} · ${slot.stylistName}`;
        let badge = slot.statusText;

        if (isNew) {
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

        const attrs = slot.type === 'open' && !isNew ? `role="button" tabindex="0" data-book-slot="${slot.id}"` : '';
        return `<div class="${slotClass}" ${attrs}><span class="agenda-time">${slot.time}</span><div class="agenda-info"><strong>${petLabel}</strong><span>${serviceLabel}</span></div><span class="${statusClass}">${badge}</span></div>`;
      })
      .join('');

    container.querySelectorAll('[data-book-slot]').forEach((el) => {
      const book = () => {
        const id = el.getAttribute('data-book-slot');
        if (!id) return;
        bookedIds.add(id);
        if (feedback) feedback.textContent = 'Cita confirmada al instante · espacio bloqueado sin traslapes.';
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
    if (feedback) feedback.textContent = 'Espacios libres respetando comidas y turnos activos.';
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
    stampsWrap.innerHTML = [1, 2, 3, 4, 5]
      .map((n) => {
        const filled = n <= visits;
        const isReward = visits === 5 && n === 5;
        const cls = ['stamp-dot', isReward ? 'is-reward' : filled ? 'is-filled' : ''].join(' ');
        return `<div class="${cls}" aria-label="Visita ${n}">${isReward ? '★' : filled ? '✓' : n}</div>`;
      })
      .join('');

    if (visits >= 5) {
      msgEl.innerHTML = '<strong>¡5 de 5 sellos!</strong> Baño gratis desbloqueado en caja';
      scanBtn.textContent = 'Canjear y reiniciar';
    } else {
      const rem = 5 - visits;
      msgEl.innerHTML = `<strong>${visits} de 5 baños</strong> · Falta ${rem} ${rem === 1 ? 'visita' : 'visitas'} para premio`;
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
    roma: { rev: '$8,460', ticket: '$470', staff: '4 activos', alert: '<strong>Stock bajo:</strong> Shampoo Hipoalergénico 1L (quedan 2 pzas)' },
    condesa: { rev: '$11,280', ticket: '$515', staff: '5 activos', alert: '<strong>Stock bajo:</strong> Bálsamo Desenredante 500ml (queda 1 pza)' },
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
      alertEl.innerHTML = `<span>${data.alert}</span><strong>Reordenar</strong>`;
    });
  });
}

/* =========================================================================
   5. (04) ROI CALCULATOR
   ========================================================================= */
function initRoiCalculator() {
  const citasInput = document.getElementById('slider-citas');
  const ticketInput = document.getElementById('slider-ticket');
  const sucursalesInput = document.getElementById('slider-sucursales');
  if (!citasInput || !ticketInput || !sucursalesInput) return;

  let recPlanVal = 'Básico — $499/mes';
  let recBranchVal = '1 sucursal';

  const update = () => {
    const citas = Number(citasInput.value);
    const ticket = Number(ticketInput.value);
    const sucursales = Number(sucursalesInput.value);

    document.getElementById('val-citas').textContent = `${citas} citas`;
    document.getElementById('val-ticket').textContent = `${formatMXN(ticket)} MXN`;
    document.getElementById('val-sucursales').textContent = `${sucursales} ${sucursales === 1 ? 'sucursal' : 'sucursales'}`;

    const recovered = Math.round(citas * ticket * 26 * sucursales * 0.1);
    const hoursSaved = Math.round((citas * 0.08 + 0.1) * 26 * sucursales);

    let price = 499;
    let label = 'Básico ($499 MXN/mes)';
    recPlanVal = 'Básico — $499/mes';
    recBranchVal = '1 sucursal';

    if (sucursales >= 6) {
      price = 2499;
      label = 'Enterprise ($2,499 MXN/mes)';
      recPlanVal = 'Enterprise — $2,499/mes';
      recBranchVal = '6 o más sucursales';
    } else if (sucursales >= 2 || citas >= 16) {
      price = 999;
      label = 'Pro ($999 MXN/mes)';
      recPlanVal = 'Pro — $999/mes';
      recBranchVal = sucursales >= 2 ? '2 a 5 sucursales' : '1 sucursal';
    }

    document.getElementById('roi-money').textContent = `${formatMXN(recovered)} MXN`;
    document.getElementById('roi-hours').textContent = `${hoursSaved} hrs`;
    document.getElementById('roi-return').textContent = `${Math.max(1, Math.round(recovered / price))}×`;
    document.getElementById('roi-plan-name').textContent = label;
  };

  [citasInput, ticketInput, sucursalesInput].forEach((el) => el.addEventListener('input', update));
  document.getElementById('cta-roi-demo')?.addEventListener('click', () => {
    const ps = document.getElementById('input-plan');
    const bs = document.getElementById('input-sucursales');
    if (ps) ps.value = recPlanVal;
    if (bs) bs.value = recBranchVal;
  });

  update();
}

/* =========================================================================
   6. (05) KERN SOCIETY INTERACTIVE PRICING CONFIGURATOR
   ========================================================================= */
function initPricingConfigurator() {
  const planBtns = Array.from(document.querySelectorAll('[data-cfg-plan]'));
  const billingBtns = Array.from(document.querySelectorAll('[data-cfg-billing]'));
  const selectBtn = document.getElementById('btn-cfg-select');
  if (!planBtns.length) return;

  const PLANS = {
    basico: {
      title: 'PawFlow Básico',
      badge: 'ESTÉTICA INDEPENDIENTE',
      desc: 'Ideal para dejar la libreta y ordenar agenda, expedientes y caja en 1 sucursal.',
      monthly: 499,
      annual: 399,
      formPlan: 'Básico — $499/mes',
      formBranches: '1 sucursal',
      quotas: [
        '1 sucursal operativa con subdominio propio',
        'Hasta 5 usuarios con inicio de turno por PIN',
        'Hasta 500 clientes con expedientes y tarjeta QR',
        'Agenda inteligente + POS, inventario y corte de caja',
      ],
    },
    pro: {
      title: 'PawFlow Pro',
      badge: 'MÁS ELEGIDO',
      desc: 'Para estéticas con equipo completo o en expansión multi-sucursal.',
      monthly: 999,
      annual: 799,
      formPlan: 'Pro — $999/mes',
      formBranches: '2 a 5 sucursales',
      quotas: [
        'Hasta 5 sucursales sincronizadas en tiempo real',
        'Hasta 25 usuarios con reloj checador por PIN',
        'Hasta 5,000 clientes con teléfonos enmascarados',
        'Matriz granular de permisos por módulo y KPIs en vivo',
      ],
    },
    enterprise: {
      title: 'PawFlow Enterprise',
      badge: 'CADENAS Y FRANQUICIAS',
      desc: 'Control global, auditoría completa y soporte prioritario para redes de estéticas.',
      monthly: 2499,
      annual: 1999,
      formPlan: 'Enterprise — $2,499/mes',
      formBranches: '6 o más sucursales',
      quotas: [
        'Hasta 20 sucursales bajo una misma consola',
        'Hasta 100 usuarios + modo Impersonate en vivo',
        'Hasta 50,000 clientes y bitácora global de auditoría',
        'Onboarding asistido y soporte prioritario por WhatsApp',
      ],
    },
  };

  let activePlan = 'pro';
  let activeBilling = 'monthly';

  const checkSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12" /></svg>`;

  function render() {
    const p = PLANS[activePlan];
    const isAnnual = activeBilling === 'annual';
    const price = isAnnual ? p.annual : p.monthly;

    planBtns.forEach((b) => b.classList.toggle('is-selected', b.getAttribute('data-cfg-plan') === activePlan));
    billingBtns.forEach((b) => b.classList.toggle('is-selected', b.getAttribute('data-cfg-billing') === activeBilling));

    document.getElementById('cfg-badge').textContent = p.badge;
    document.getElementById('cfg-title').textContent = p.title;
    document.getElementById('cfg-desc').textContent = p.desc;
    document.getElementById('cfg-price').textContent = formatMXN(price);
    document.getElementById('cfg-period').textContent = isAnnual ? 'MXN / mes (anual -20%)' : 'MXN / mes';
    document.getElementById('cfg-quotas').innerHTML = p.quotas.map((q) => `<li>${checkSvg}<span>${q}</span></li>`).join('');

    Object.entries(PLANS).forEach(([key, spec]) => {
      const el = document.querySelector(`[data-mini-price="${key}"]`);
      if (el) el.textContent = formatMXN(isAnnual ? spec.annual : spec.monthly);
    });
  }

  planBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activePlan = btn.getAttribute('data-cfg-plan') || 'pro';
      render();
    });
  });

  billingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBilling = btn.getAttribute('data-cfg-billing') || 'monthly';
      render();
    });
  });

  selectBtn?.addEventListener('click', () => {
    const p = PLANS[activePlan];
    const planSelect = document.getElementById('input-plan');
    const branchSelect = document.getElementById('input-sucursales');
    if (planSelect) planSelect.value = p.formPlan;
    if (branchSelect) branchSelect.value = p.formBranches;
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => document.getElementById('input-nombre')?.focus({ preventScroll: true }), 450);
  });

  render();
}

/* =========================================================================
   7. FAQ, DEMO FORM & CLIENT PORTAL MODAL
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

function initDemoForm() {
  const form = document.getElementById('form-demo');
  const successBox = document.getElementById('demo-success');
  const summaryEl = document.getElementById('demo-success-summary');
  const confirmWaBtn = document.getElementById('btn-confirm-wa');
  const resetBtn = document.getElementById('btn-reset-form');
  if (!form || !successBox) return;

  const setErr = (field, msg) => {
    form.querySelector(`[name="${field}"]`)?.classList.toggle('is-invalid', Boolean(msg));
    const el = form.querySelector(`[data-error-for="${field}"]`);
    if (el) el.textContent = msg || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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

    let valid = true;
    ['nombre', 'estetica', 'whatsapp', 'email'].forEach((k) => setErr(k, ''));
    if (data.nombre.length < 2) { setErr('nombre', 'Ingresa tu nombre.'); valid = false; }
    if (data.estetica.length < 2) { setErr('estetica', 'Ingresa el nombre de tu estética.'); valid = false; }
    if (data.whatsapp.replace(/\D/g, '').length < 10) { setErr('whatsapp', 'Ingresa mínimo 10 dígitos.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setErr('email', 'Ingresa un correo válido.'); valid = false; }
    if (!valid) return;

    try {
      localStorage.setItem('pawflow_last_demo_request', JSON.stringify(data));
      if (SITE_CONFIG.demoWebhookUrl) {
        await fetch(SITE_CONFIG.demoWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      }
    } catch {
      // ignore webhook error
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div><strong>Contacto:</strong> ${escapeHtml(data.nombre)}</div>
        <div><strong>Estética:</strong> ${escapeHtml(data.estetica)} (${escapeHtml(data.sucursales)})</div>
        <div><strong>Plan:</strong> ${escapeHtml(data.plan)}</div>
        <div><strong>WhatsApp / Correo:</strong> ${escapeHtml(data.whatsapp)} · ${escapeHtml(data.email)}</div>
      `;
    }

    const waText = [
      `Hola equipo ${SITE_CONFIG.brandName}, solicité demo y prueba gratis de 14 días:`,
      `• Nombre: ${data.nombre}`,
      `• Estética: ${data.estetica} (${data.sucursales})`,
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

  const openModal = () => {
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => input?.focus(), 60);
  };
  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-open-login]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  });
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const clean = slugify(input?.value || '');
    if (!clean) return;
    window.location.href = isMountedWithCrm ? `/?tenant=${encodeURIComponent(clean)}` : `https://${clean}.${SITE_CONFIG.portalDomain}`;
  });
}

/* =========================================================================
   8. LIGHT & SHADE MOTION ENGINE (CLOCK, SPLIT-TEXT, ROLL, CURSOR, PARALLAX)
   ========================================================================= */
function initStudioClock() {
  const el = document.getElementById('studio-live-clock');
  if (!el) return;
  const tick = () => {
    try {
      const now = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      el.textContent = `${now} hrs`;
    } catch {
      const d = new Date();
      el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} hrs`;
    }
  };
  tick();
  window.setInterval(tick, 15000);
}

function initSplitText() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('[data-split]').forEach((heading) => {
    heading.setAttribute('aria-label', heading.textContent.replace(/\s+/g, ' ').trim());
    let charIndex = 0;

    const splitNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        (node.textContent || '').split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) { frag.appendChild(document.createTextNode(' ')); return; }
          const wordSpan = document.createElement('span');
          wordSpan.className = 'split-word';
          wordSpan.setAttribute('aria-hidden', 'true');
          Array.from(token).forEach((ch) => {
            const c = document.createElement('span');
            c.className = 'split-char';
            c.style.setProperty('--char-i', String(Math.min(charIndex++, 36)));
            c.textContent = ch;
            wordSpan.appendChild(c);
          });
          frag.appendChild(wordSpan);
        });
        return frag;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        Array.from(node.childNodes).forEach((child) => clone.appendChild(splitNode(child)));
        return clone;
      }
      return document.createDocumentFragment();
    };

    const next = document.createDocumentFragment();
    Array.from(heading.childNodes).forEach((c) => next.appendChild(splitNode(c)));
    heading.textContent = '';
    heading.appendChild(next);
  });
}

function initRollLinks() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('[data-roll]').forEach((el) => {
    const text = el.textContent.trim();
    if (!text) return;
    el.classList.add('roll-link');
    el.innerHTML = `<span class="roll-mask" aria-hidden="true"><span class="roll-link__track"><span class="roll-link__copy">${escapeHtml(text)}</span><span class="roll-link__copy">${escapeHtml(text)}</span></span></span><span class="sr-only">${escapeHtml(text)}</span>`;
  });
}

function initScrollProgressAndParallax() {
  const bar = document.getElementById('scroll-progress-bar');
  const frames = Array.from(document.querySelectorAll('[data-parallax]'));
  const reduced = prefersReducedMotion();
  let ticking = false;

  const update = () => {
    ticking = false;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (bar && docH > 0) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / docH))})`;
    if (reduced) return;

    const vh = window.innerHeight;
    frames.forEach((frame) => {
      const rect = frame.getBoundingClientRect();
      if (rect.bottom < -60 || rect.top > vh + 60) return;
      const strength = Number(frame.getAttribute('data-parallax')) || 20;
      const ratio = (rect.top + rect.height * 0.5 - vh * 0.5) / (vh * 0.5);
      frame.style.setProperty('--parallax-y', `${Math.max(-strength, Math.min(strength, ratio * -strength)).toFixed(1)}px`);
    });
  };

  const onScroll = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

function initEditorialCursorAndMagnetics() {
  const fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine || prefersReducedMotion()) return;

  document.querySelectorAll('[data-spotlight]').forEach((surface) => {
    surface.addEventListener('pointermove', (e) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      surface.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
      const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
      btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

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
      if (!el.classList.contains('is-in') && el.getBoundingClientRect().top <= cutoff) {
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
  initKineticWordmark();
  initSplitText();
  initRollLinks();
  initTestDriveSandbox();
  initRoiCalculator();
  initPricingConfigurator();
  initFaq();
  initDemoForm();
  initPortalModal();
  initScrollProgressAndParallax();
  initEditorialCursorAndMagnetics();
  initReveal();
});
