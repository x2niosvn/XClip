import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      offscreen: true,
    },
  });

  // Optimized for Taskbar, Desktop & Mobile:
  // - Large, bold, punchy central "X" with high contrast
  // - 100% genuine alpha transparency outside squircle
  // - Vibrant, luminous gradients that look stunning at both 24px and 512px
  const svgContent = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <defs>
      <!-- Base Canvas Gradient -->
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1E1B4B" />
        <stop offset="50%" stop-color="#14132B" />
        <stop offset="100%" stop-color="#090818" />
      </linearGradient>

      <!-- Ambient Edge Glow for Squircle -->
      <linearGradient id="rimGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#818CF8" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#6366F1" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#06B6D4" stop-opacity="0.9" />
      </linearGradient>

      <!-- Glass Highlight -->
      <linearGradient id="topSheen" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.25" />
        <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </linearGradient>

      <!-- Clipboard Body (Frosted Glass) -->
      <linearGradient id="boardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#2D2A5E" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#131226" stop-opacity="0.96" />
      </linearGradient>

      <!-- Titanium Clip -->
      <linearGradient id="clipTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="30%" stop-color="#CBD5E1" />
        <stop offset="70%" stop-color="#E2E8F0" />
        <stop offset="100%" stop-color="#64748B" />
      </linearGradient>

      <!-- Bold Geometric Arm 1 (Electric Cyan to Royal Blue) -->
      <linearGradient id="geomCyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38BDF8" />
        <stop offset="35%" stop-color="#0EA5E9" />
        <stop offset="100%" stop-color="#2563EB" />
      </linearGradient>

      <!-- Bold Geometric Arm 2 (Electric Neon Violet to Deep Indigo) -->
      <linearGradient id="geomViolet" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C084FC" />
        <stop offset="40%" stop-color="#9333EA" />
        <stop offset="100%" stop-color="#4F46E5" />
      </linearGradient>

      <!-- Core Radial Glow -->
      <radialGradient id="centerGlow" cx="50%" cy="54%" r="40%">
        <stop offset="0%" stop-color="#6366F1" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#6366F1" stop-opacity="0" />
      </radialGradient>

      <!-- Drop Shadows -->
      <filter id="squircleDropShadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.65" />
      </filter>

      <filter id="arm3dShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.8" />
      </filter>
    </defs>

    <!-- SQUIRCLE CONTAINER (100% Transparent outside) -->
    <rect x="36" y="36" width="440" height="440" rx="104" fill="url(#bgGradient)" filter="url(#squircleDropShadow)" />
    
    <!-- Outer Rim Glow -->
    <rect x="38" y="38" width="436" height="436" rx="102" fill="none" stroke="url(#rimGlow)" stroke-width="2.5" />

    <!-- Ambient Top Sheen -->
    <path d="M 36 140 C 36 82, 82 36, 140 36 L 372 36 C 430 36, 476 82, 476 140 C 360 170, 152 170, 36 140 Z" fill="url(#topSheen)" />

    <!-- Ambient Glow behind Central Icon -->
    <rect x="36" y="36" width="440" height="440" rx="104" fill="url(#centerGlow)" />

    <!-- Prominent Frosted Glass Clipboard Card -->
    <rect x="108" y="96" width="296" height="332" rx="28" fill="url(#boardGrad)" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.25" />

    <!-- Top Metallic Clip -->
    <rect x="188" y="78" width="136" height="42" rx="10" fill="url(#clipTitanium)" />
    <rect x="198" y="86" width="116" height="7" rx="3.5" fill="#0F172A" fill-opacity="0.35" />
    <!-- Clip Wire Loop -->
    <rect x="224" y="58" width="64" height="32" rx="12" fill="none" stroke="url(#clipTitanium)" stroke-width="7" />
    <circle cx="256" cy="100" r="5" fill="#1E293B" />

    <!-- Subtly etched sync circuits on the clipboard -->
    <path d="M 148 400 Q 256 384 364 400" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-opacity="0.35" stroke-linecap="round" />

    <!-- BOLD, ICONIC, RADIANT "X" (Scales beautifully from 16px to 512px) -->
    <!-- Arm 2 (Violet, Back Layer): Top-Right to Bottom-Left -->
    <g>
      <!-- Base Polygon for Violet Arm -->
      <polygon points="340,166 386,196 172,374 126,344" fill="url(#geomViolet)" />
      <!-- Beveled Highlight Facet -->
      <polygon points="340,166 386,196 366,214 320,184" fill="#FFFFFF" fill-opacity="0.4" />
      <!-- Crisp Center Ridge Line -->
      <line x1="363" y1="181" x2="149" y2="359" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="4.5" stroke-linecap="round" />
    </g>

    <!-- Arm 1 (Cyan, Front Layer with deep 3D Shadow): Top-Left to Bottom-Right -->
    <g filter="url(#arm3dShadow)">
      <!-- Base Polygon for Cyan Arm -->
      <polygon points="126,196 172,166 386,344 340,374" fill="url(#geomCyan)" />
      <!-- Beveled Highlight Facet -->
      <polygon points="126,196 172,166 192,184 146,214" fill="#FFFFFF" fill-opacity="0.4" />
      <!-- Crisp Center Ridge Line -->
      <line x1="149" y1="181" x2="363" y2="359" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="4.5" stroke-linecap="round" />
    </g>

    <!-- Center Precision Diamond Core Node -->
    <polygon points="256,244 278,266 256,288 234,266" fill="#FFFFFF" />
    <polygon points="256,250 272,266 256,282 240,266" fill="#38BDF8" />
  </svg>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 512px;
            height: 512px;
            background: transparent !important;
            overflow: hidden;
          }
          svg {
            display: block;
            width: 512px;
            height: 512px;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `;

  const htmlDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await win.loadURL(htmlDataUrl);

  await new Promise((r) => setTimeout(r, 400));

  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();

  const assetsDir = path.resolve(__dirname, '../assets');
  const iconPath = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(iconPath, pngBuffer);
  console.log('Successfully written icon to:', iconPath);

  app.quit();
});
