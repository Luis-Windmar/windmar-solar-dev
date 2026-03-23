# Windmar Deal Section — Branding & Aesthetic Guide

This document tells the Claude session building the Deal Section exactly how to
style it so it matches the PreQual questionnaire visually.

---

## Color Palette

| Element | Value | Notes |
|---------|-------|-------|
| Primary blue | `#1B3F8B` | Windmar logo lettering color |
| Accent orange | `#F5A623` | Windmar logo sun color |
| Background | `#EBF1FF` | Soft blue — applied to the full page background |
| Banner background | `#ffffff` | White |
| Banner border | `3px solid #1B3F8B` | Bottom border only |
| User bubbles | `#1B3F8B` background, `white` text | Right-aligned |
| Assistant bubbles | `#ffffff` background, `#1f2937` text, `1px solid #e5e7eb` border | Left-aligned |
| Timestamp (user) | `#93c5fd` | Light blue |
| Timestamp (assistant) | `#9ca3af` | Light gray |
| Loading spinner | `#F5A623` | Orange |
| Test mode badge | `#1B3F8B` background, `white` text | |

---

## Banner / Header

The banner is a white bar at the top with a blue bottom border. It contains:
1. The Windmar Commercial logo (left side)
2. A vertical divider line
3. Two lines of text to the right of the divider

```jsx
<div
  className="p-3 shadow-lg flex items-center gap-3"
  style={{background:'#ffffff', borderBottom:'3px solid #1B3F8B'}}
>
  <img src="/logo.png" alt="Windmar Commercial" style={{height:'52px', width:'auto'}} />
  <div style={{borderLeft:'2px solid #e5e7eb', paddingLeft:'12px'}}>
    <p className="text-sm font-semibold" style={{color:'#1B3F8B'}}>Cotización Solar Comercial</p>
    <p className="text-xs" style={{color:'#F5A623'}}>para su negocio</p>
  </div>
  {testMode && (
    <span className="ml-auto text-xs rounded px-2 py-1" style={{background:'#1B3F8B', color:'white'}}>
      🧪 MODO PRUEBA · Step: {step}
    </span>
  )}
</div>
```

**Change the two text lines** to whatever makes sense for the Deal Section, e.g.:
- Line 1: `Cotización Solar Comercial`
- Line 2: `Detalle de su propuesta`

---

## Page Background

The outer wrapper div should use the `#EBF1FF` background:

```jsx
<div
  className="flex flex-col h-screen"
  style={{background:'#EBF1FF'}}
>
```

Do NOT use Tailwind gradient classes like `bg-gradient-to-br from-yellow-50 to-orange-50`
— use the inline style above instead.

---

## Chat Bubbles

Use inline `style` props for colors instead of Tailwind color classes.
This avoids issues with Tailwind CDN not recognizing custom colors.

```jsx
<div
  className="max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm"
  style={m.role === 'user'
    ? {background: '#1B3F8B', color: 'white'}
    : {background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb'}}
>
  {m.content}
  <div
    className="text-xs mt-1"
    style={m.role === 'user' ? {color: '#93c5fd'} : {color: '#9ca3af'}}
  >
    {m.timestamp.toLocaleTimeString('es-PR', {hour:'2-digit', minute:'2-digit'})}
  </div>
</div>
```

---

## Logo File

- Filename: `logo.png`
- Location: `public/logo.png` (same folder as `bundle.js` and `index.html`)
- The file is already there from the PreQual setup — no need to copy it again
- It is a transparent PNG of the Windmar Commercial logo
- Referenced in JSX as `<img src="/logo.png" ... />`

---

## Tailwind CSS

Use the runtime CDN version in `index.html` — NOT the old cdnjs version:

```html
<!-- ✅ Correct -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- ❌ Wrong — does not process utility classes correctly -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.js"></script>
```

---

## index.html Template

Use this exact template for any new questionnaire page:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización Solar — Windmar</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    html, body, #root { height: 100%; margin: 0; padding: 0; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/deal_bundle.js"></script>
</body>
</html>
```

---

## Clickable Links in Chat

To render a clickable button inside the chat flow, use a `link_message` type:

```jsx
// In your say() / message logic, emit a message like:
{
  type: 'link_message',
  href: 'https://www.windmar.com/...',
  label: '📋 Llenar cuestionario detallado',
  role: 'assistant',
  timestamp: new Date()
}

// In your message renderer, handle it like:
} : m.type === 'link_message' ? (
  <div
    className="max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm cursor-pointer font-semibold"
    style={{background:'#F5A623', color:'white'}}
    onClick={() => window.open(m.href, '_blank')}
  >
    {m.label}
  </div>
) : (
  // default bubble
```

---

## Icons

The PreQual uses `lucide-react` for icons: `Send`, `Upload`, `Loader2`, `Sun`.
The Deal Section can use the same imports:

```jsx
import { Send, Upload, Loader2, Sun } from 'lucide-react';
```

The `Sun` icon is NOT used in the banner anymore (replaced by the logo image),
but keep the import in case it's used elsewhere.

---

## OCR Card & Estimate Card Accent Colors

If the Deal Section reuses or displays OCR review cards or estimate cards,
keep these accent colors consistent with PreQual:

| Card element | Color |
|-------------|-------|
| Card header background | `bg-orange-50` / `#fff7ed` |
| Card header text | `text-orange-800` |
| Card header subtext | `text-orange-600` |
| Section accents | `bg-blue-50`, `bg-green-50`, `bg-gray-50` |
| Negative values | `text-red-600` |

---

## Building & Deploying the Deal Section

See `README_Backend_Build.md` for the full build process. In summary:

1. Create `DealSection.jsx` in Claude (with mock data for testing)
2. Save as `src/DealSection_api.jsx` on your machine
3. Create `src/deal_main.jsx`:
   ```jsx
   import React from 'react';
   import ReactDOM from 'react-dom/client';
   import DealSection from './DealSection_api.jsx';
   const root = ReactDOM.createRoot(document.getElementById('root'));
   root.render(<DealSection />);
   ```
4. Create `public/deal.html` using the template above (point to `/deal_bundle.js`)
5. Add route in `server.js`:
   ```javascript
   app.get('/deal', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'deal.html'));
   });
   ```
6. Add to `patch_and_build.sh`:
   ```bash
   npx esbuild src/deal_main.jsx --bundle --outfile=public/deal_bundle.js \
     --platform=browser --target=es2020 --loader:.jsx=jsx \
     --define:process.env.NODE_ENV='"production"'
   ```
7. Access at `http://localhost:3001/deal`
