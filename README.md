# XClip — Clipboard. Synced locally.

> Modern, ultra-fast LAN-only clipboard manager and peer-to-peer synchronization desktop application for Windows.

---

## 🔒 Privacy & Architecture

* **100% Local Network**: Clipboard data never leaves your local Wi-Fi or Ethernet network.
* **No Cloud / No External Server**: No account creation, no VPS, zero third-party internet dependencies.
* **End-to-End Encryption**: All LAN peer transmissions are encrypted using **AES-256-GCM** with authenticated key verification.
* **Independent Peer Mesh**: Every computer running XClip is an autonomous peer.
* **Zero Logging of Contents**: Application logs capture operational lifecycle events (start, peer connect, pairing), but never log clipboard contents or secrets.

---

## 🚀 Key Features

1. **System Clipboard Monitoring**:
   * Continuous background watcher with low CPU overhead (~0% idle).
   * SHA-256 deduplication (repeated copies do not flood database).
   * Smart classification: `TEXT`, `🔗 URL`, `</> CODE` (with language heuristic tag), `🖼 IMAGE` (stored efficiently on disk as PNGs), and `📁 FILE`.
   * Re-entry suppression when copying items back to the clipboard.

2. **Raycast / Linear Aesthetic**:
   * Dark-mode first developer tool design with rounded cards and subtle borders.
   * Grouped `PINNED` and `RECENT` sections.
   * Fast keyword search and category filter bar (`All`, `Pinned`, `Text`, `Code`, `Links`, `Images`, `Files`).
   * Full content preview modal.

3. **Global Hotkey & System Tray**:
   * Default global shortcut: **`Ctrl + Shift + V`**.
   * Instant popup with keyboard navigation (`↑`/`↓` navigate, `Enter` copy, `Esc` close).
   * Native Windows system tray with right-click menu, quick pause toggle, and minimize-to-tray behavior.

4. **LAN Device Discovery & Pairing**:
   * Automatic mDNS / Bonjour zero-configuration discovery (`_xclip._tcp`).
   * Mutual trust pairing flow using short 6-digit confirmation codes (e.g. `482 913`).
   * Reconnection resilience if a peer temporarily goes offline.

5. **Privacy Controls**:
   * Exclude passwords heuristic (automatically filters out API keys, JWT tokens, private keys, and high-entropy secrets).
   * Configurable auto-delete (Never, 24h, 7 days, 30 days).
   * Clear unpinned history or reset all application data in one click.
   * Quick toggle to pause clipboard monitoring at any time.

---

## 📁 Project Structure

```text
XClip/
├── assets/                       # Application icons and branding
├── scripts/
│   └── dev.mjs                   # Integrated Vite + Electron development runner
├── src/
│   ├── main/                     # Electron Main Process
│   │   ├── clipboard/
│   │   │   ├── classifier.ts     # Content classification & password heuristics
│   │   │   └── watcher.ts        # Low-overhead clipboard polling engine
│   │   ├── database/
│   │   │   └── database.ts       # SQLite repository using better-sqlite3
│   │   ├── shortcuts/
│   │   │   └── global.ts         # Global hotkey manager (Ctrl+Shift+V)
│   │   ├── sync/
│   │   │   ├── crypto.ts         # AES-256-GCM encryption & pairing codes
│   │   │   ├── discovery.ts      # mDNS Bonjour LAN device advertising & browsing
│   │   │   └── peer.ts           # WebSocket P2P mesh & pairing handshake
│   │   ├── tray/
│   │   │   └── tray.ts           # Windows system tray integration
│   │   ├── index.ts              # Main entry point, lifecycle & IPC handlers
│   │   └── logger.ts             # Safe structured file logger
│   │
│   ├── preload/
│   │   └── index.ts              # Secure contextBridge IPC exposure (nodeIntegration: false)
│   │
│   ├── renderer/                 # Modern React UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ClipboardCard.tsx
│   │   │   │   ├── ClipboardList.tsx
│   │   │   │   ├── DetailModal.tsx
│   │   │   │   ├── DevicesModal.tsx
│   │   │   │   ├── FilterBar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── OnboardingModal.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── SettingsModal.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── utils/
│   │   │   │   └── formatters.ts
│   │   │   ├── App.tsx
│   │   │   ├── index.css
│   │   │   └── main.tsx
│   │   └── index.html
│   │
│   └── shared/
│       └── types/
│           └── index.ts          # Shared TypeScript interfaces and contracts
│
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.preload.json
├── tsconfig.renderer.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 🛠 Prerequisites

* Windows 10 or Windows 11 (64-bit)
* Node.js v18+ (tested with Node v24)
* npm

---

## 💻 Installation & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Mode
Runs the Vite dev server with hot module replacement (HMR) and launches the Electron application:
```bash
npm run dev
```

### 3. Production Build
Compiles renderer with Vite and compiles main and preload scripts with TypeScript:
```bash
npm run build
```

### 4. Run Built Production App
```bash
npm start
```

### 5. Package Windows Installer & Portable Executable
Generates NSIS installer and portable `.exe` in the `release/` folder using `electron-builder`:
```bash
npm run package
```

---

## 📡 How LAN Discovery Works

1. On startup, each XClip instance queries the system hostname and generates or loads a persistent device identity (e.g. `xclip-8f91a2b3`).
2. The instance announces a `_xclip._tcp` service via mDNS (`bonjour-service`) with its Device ID, display name, and local listening port (e.g. `38721`).
3. Concurrently, it continuously listens for other `_xclip._tcp` service announcements on the local subnet.
4. When a new peer is discovered, it appears under **Sync Devices** as `Available` without requiring any manual IP configuration.

---

## 🤝 How Device Pairing Works

Devices do **not** automatically trust or sync with unknown machines.

```text
Initiator (PC 1)                       Target (PC 2)
      │                                      │
      │─── 1. PAIR_REQUEST (Code & Secret) ─▶│
      │                                      │ (Displays incoming prompt with code)
      │                                      │
      │◀── 2. PAIR_ACCEPT (Code confirmed) ──│
      │                                      │
      ▼                                      ▼
[Save to Trusted Devices]              [Save to Trusted Devices]
      │                                      │
      └───────── 3. AES-256-GCM Sync ────────┘
```

1. The user clicks **Pair** on an available peer.
2. PC 1 generates a 6-digit numeric verification code (e.g. `482 913`) and a 256-bit random shared secret.
3. PC 1 sends a `PAIR_REQUEST` over WebSocket to PC 2.
4. PC 2 displays an incoming modal showing the same pairing code and the name of the requesting PC.
5. Once confirmed, PC 2 responds with `PAIR_ACCEPT`. Both devices store the peer in their local SQLite `devices` table with the pre-shared encryption key.

---

## 🔐 How Clipboard Synchronization & Security Work

1. When an item is copied on PC 1, the clipboard watcher hashes the content and saves it locally.
2. If LAN sync is enabled, PC 1 derives an encryption key from the paired device's shared secret using HKDF-SHA256.
3. The clipboard item payload is encrypted using **AES-256-GCM** with a fresh 12-byte initialization vector (IV) and 16-byte authentication tag.
4. The encrypted envelope containing `message_id`, `source_device_id`, `ciphertext`, `iv`, and `auth_tag` is sent directly over the local WebSocket connection to paired peers.
5. PC 2 verifies the auth tag, decrypts the payload, checks for duplicate `message_id`, and inserts the item into its local SQLite history.
6. A loop prevention mechanism ensures synced items are not re-broadcast endlessly.

---

## 📄 License
MIT License. Built for private, local-first computing.
