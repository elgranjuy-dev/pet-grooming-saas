# PawFlow — Landing Page Comercial

Landing page estática e independiente para promocionar y vender el CRM de estéticas caninas, lista para desplegar en tu dominio principal (`pawflow.mx`, `petgrooming.mx`, etc.).

## Estructura

- `index.html` — Estructura semántica HTML5, metadatos SEO/OpenGraph y JSON-LD.
- `css/styles.css` — Sistema de diseño en Vanilla CSS (sin dependencias externas de estilos).
- `js/main.js` — Configuración centralizada y módulos interactivos (recorrido del CRM, calculadora ROI, planes mensual/anual, FAQ, formulario de demo + WhatsApp y modal de acceso por subdominio).
- `assets/` — Fotografías editoriales listas para producción.

## Configuración rápida antes de publicar

Edita el bloque `SITE_CONFIG` al inicio de `js/main.js`:

```js
const SITE_CONFIG = {
  brandName: 'PawFlow',
  whatsappNumber: '5215512345678',      // Tu WhatsApp real (código país + número sin "+")
  portalDomain: 'pawflow.mx',           // Dominio base para subdominios de clientes
  crmGeneralUrl: 'https://app.pawflow.mx',
  demoWebhookUrl: '',                   // Opcional: webhook (Make, n8n, Formspree o tu API)
};
```

## Despliegue

Al ser HTML/CSS/JS puro, puedes publicar directamente la carpeta `landing/` en:

- **Cloudflare Pages / Netlify / Vercel**: apunta el *Publish / Root directory* a `landing`.
- **Nginx / Servidor propio**: sirve `landing/` en el dominio raíz mientras tus subdominios (`*.tudominio.mx`) apuntan a la aplicación CRM (`frontend/`).
