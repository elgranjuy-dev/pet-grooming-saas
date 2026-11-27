# PawFlow — Landing Page Comercial (Blue Heeler × Editorial Edition)

Landing page comercial estática e independiente para promocionar y vender el CRM de estéticas caninas, con paleta inspirada en el **Australian Cattle Dog (Blue Heeler)** (blanco escarcha, gris merle, azul acero/cobalto, negro máscara y acento cobrizo) e interacciones editoriales inspiradas en **Kern Society** y **Light & Shade**.

## Estructura

- `index.html` — Estructura semántica HTML5, fuentes variables (`Roboto Flex`, `Fraunces`, `Recursive`), metadatos SEO/OpenGraph y JSON-LD.
- `css/styles.css` — Sistema de diseño en Vanilla CSS con paleta Blue Heeler.
- `js/main.js` — Configuración centralizada (`SITE_CONFIG`) y módulos interactivos (wordmark variable reactivo al cursor, Test Drive en vivo con el nombre de tu estética, calculadora ROI, configurador interactivo de plan, FAQ, formulario de demo + WhatsApp y modal de acceso por subdominio).
- `assets/` — Fotografías editoriales (`heeler-hero.jpg` y `heeler-banner.jpg`).

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

## Cómo verla en local y desplegarla

- **Junto con tu CRM (FastAPI)**: al correr `./iniciar_local.sh`, queda disponible en `/landing/` en el mismo puerto `8000` donde operas el CRM.
- **Despliegue independiente**: publica directamente la carpeta `landing/` en Cloudflare Pages, Netlify, Vercel o Nginx apuntando a tu dominio raíz mientras `*.tudominio.mx` sirve el CRM (`frontend/`).
