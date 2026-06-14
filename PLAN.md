# NinjaSage Modding Toolkit — Rencana Implementasi

Aplikasi Electron + Vite + React untuk modding SWF game Flash, denganffdec-cli.exe sebagai engine inti.

---

## Arsitektur

```
┌──────────────────────────────────────────────────────┐
│  NinjaSage Modding Toolkit                            │
├──────────────────────────────────────────────────────┤
│  Menu Bar: File | View | SWF | Tools | Help           │
│  Toolbar: [≡ Open] [↻] [🔍] [🧹] [▶ Build]          │
├────────────┬─────────────────────────────────────────┤
│ Explorer   │  Preview / Content Area                  │
│ Panel      │                                         │
│ (Tree)     │  (Berganti sesuai konteks / module)      │
│            │                                         │
│            │  Context Menu: ← Muncul action sesuai    │
│            │                  item yang diklik kanan   │
└────────────┴─────────────────────────────────────────┘
```

### Konsep Navigasi

- **Welcome Page** (default) — blank, tombol "Open SWF"
- **Setelah buka SWF** → Explorer Panel (kiri) + Content (kanan)
- **Klik kanan item** → menu konteks → action dari module terkait
- **Menu bar & toolbar** — akses ke semua module

---

## Module 1: SWF Explorer 🔍

| Item | Klik Kanan → Action |
|------|-------------------|
| Header | — |
| Tags | — |
| Class | Replace Script, Export, View Dependencies |
| Image | Export, Replace |
| Sound | Preview, Replace, Export |
| Sprite | Export Frames, Replace |

### ffdec-cli
- `-dumpSWF in.swf`
- `-dumpAS3 in.swf`
- `-header in.swf`
- `-linkReport in.swf`

### Fitur
1. **Header view**: version, FPS, dimensions, compression
2. **Tag tree**: semua tag terklasifikasi
3. **Class list**: filter/search by package, export CSV
4. **Asset preview**: thumbnail images, waveform sounds
5. **Dependency graph**: class → class relationships
6. **SWF diff**: compare 2 SWF files

---

## Module 2: Script Swapper 🔧

Mengganti ActionScript class definitions di SWF dengan file `.as` hasil modding.

### ffdec-cli
- `-replace in.swf out.swf "full.ClassName" file.as`
- `-dumpAS3 in.swf` (reuse dari Explorer)

### Fitur
1. **Class list** → assign `.as` file
2. **Auto-detect** package dari file `.as`
3. **Multiple replacements** dalam satu session
4. **Progress bar** per-replace
5. **History & rollback** dengan backup otomatis
6. **Batch config** load/save JSON (format seperti `build-swf.ps1`)

### Context Entry
- Klik kanan class di Explorer → Replace Script

---

## Module 3: Asset Forge 🎨

Export/import visual assets (gambar, sprite, shape) dari/ke SWF.

### ffdec-cli
- `-export outdir in.swf`
- `-importImages in.swf "folder"`
- `-importShapes in.swf "folder"`
- `-importSprites in.swf "folder"`
- `-importSounds in.swf "folder"`
- `-replaceAlpha in.swf out.swf tagId image.png`
- `-replaceCharacter in.swf out.swf oldId newId`

### Fitur
1. **Asset browser** tree dengan preview thumbnail
2. **Export** selected/batch ke folder
3. **Import** drag-drop PNG/JPG/SVG untuk replace
4. **Alpha channel editor** untuk JPEG3/4
5. **NinjaSage presets**: items/, skills/, pets/, enemy/, materials/

### Context Entry
- Klik kanan image/sprite di Explorer → Export / Replace

---

## Module 4: Panel Studio 🖼️

Kelola external panel SWF yang di-load runtime.

### ffdec-cli
- `-export outdir panel.swf`
- `-replace in.swf out.swf "Class" file.as`
- `-importScript in.swf file.as`
- `-dumpAS3 in.swf`

### Fitur
1. **Panel library** — scan folder, list + preview
2. **Panel editor** — replace script, import asset
3. **Panel creator** — dari template + auto-generate class stub
4. **Panel mapper** — relasi panel SWF ↔ class `id.ninjasage.features.*`
5. **Integration check** — cek panel terdaftar di HUD, tidak terpakai, dll.

### Context Entry
- Klik kanan panel entry → Edit Panel
- Menu: SWF > Panel Studio

---

## Module 5: SWF Builder 🔨

Build pipeline GUI: baseline → replace → compress → output.

### ffdec-cli
- `-replace` (multi-step)
- `-compress`
- `-enableDebugging`

### Fitur
1. **Build config** — load/save JSON
2. **Replacement list editor** — drag-drop, auto-detect class, import dari PS1
3. **Build execution** — progress bar, log, abort
4. **Presets** — Full Build, Quick Build, Debug Build
5. **Build history** — log, timestamps, rollback

### Context Entry
- Toolbar: ▶ Build
- Menu: File > Build SWF

---

## Module 6: Game Data Editor 📊

Visual editor untuk JSON database NinjaSage (`databases/json/`).

### Tools
- Tidak pakai ffdec — murni JSON editor
- Validasi cross-reference antar file

### Fitur
1. **File browser** — list semua JSON
2. **Spreadsheet-style editor** — grid dengan edit inline
3. **Validasi** — tipe data, duplicate key, referensi valid
4. **Diff & change tracking** — undo/redo, highlight perubahan
5. **Bulk operations** — multi-edit, CSV import/export
6. **Data graph** — relasi visual antar tabel

### Context Entry
- Menu: Tools > Game Data Editor

---

## Module 7: AMF Service Builder 🔌

Generator AMF service server + client stub.

### Referensi
- `tools/scaffold-amf-service.js`
- `docs/SERVICE_AUDIT.json`

### Fitur
1. **Service catalog** — dari SERVICE_AUDIT.json
2. **Service creator** — form → generate handler + AS3 stub
3. **Client stub generator** — ActionScript untuk client-side AMF call
4. **AMF inspector** — record & test service
5. **Migration tracker** — visual progress migrasi handler

### Context Entry
- Menu: Tools > AMF Service Builder

---

## Module 8: Text Localizer 🌐

Ekstrak, edit, dan re-import semua teks untuk translasi.

### ffdec-cli
- `-export outdir in.swf`
- `-importText in.swf "folder"`
- `-replace` (untuk AS3 strings)

### Fitur
1. **SWF text extractor** — static, dynamic, AS3 strings
2. **Translation editor** — table + filter + progress
3. **Text re-importer** — inject ke SWF/AS/JSON
4. **In-context preview** — cek overflow, character set
5. **Language profile** — save/load/multiple language
6. **String deduplication** — merge string yang sama

### Context Entry
- Klik kanan text item → Translate
- Menu: Tools > Text Localizer

---

## Module 9: Mission Editor 🗺️

Visual editor untuk misi/quest.

### ffdec-cli
- `-export outdir mission.swf`
- `-replace` (class misi)
- `-importImages` (map/background)

### Fitur
1. **Mission catalog** — list + filter dari mission.json
2. **Stage editor** — enemy, reward, condition setup
3. **Map/background editor** — preview + replace
4. **Exam chain visualizer** — tree diagram stage flow
5. **Test mode** — simulasi damage & reward

### Context Entry
- Menu: Tools > Mission Editor

---

## Module 10: Sound Studio 🎵

Manage & replace audio.

### ffdec-cli
- `-export outdir in.swf`
- `-importSounds in.swf "folder"`
- `-remove` (hapus sound)

### Fitur
1. **Sound library** — scan folder + embedded SWF
2. **Audio player** — waveform, play/pause/seek
3. **Sound replacer** — drag-drop MP3/WAV
4. **Sound exporter** — dari SWF ke file
5. **Sound mapper** — mapping sound ID → gameplay context
6. **Optimization** — compress bitrate, remove unused

### Context Entry
- Klik kanan sound di Explorer → Preview / Replace
- Menu: Tools > Sound Studio

---

## Struktur Proyek

```
modding_tools/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── electron-builder.yml
├── index.html
├── .gitignore
├── PLAN.md
│
├── electron/                    ← Main process (Node.js)
│   ├── main.ts                  ← App entry, window, menu
│   ├── preload.ts               ← Context bridge (IPC)
│   └── services/
│       ├── ffdec-service.ts     ← ffdec-cli wrapper (spawn)
│       ├── project-service.ts   ← NinjaSage project detection
│       └── config-service.ts    ← User config (persistent)
│
├── src/                         ← Renderer (React)
│   ├── main.tsx                 ← React entry
│   ├── App.tsx                  ← Root: menu bar + layout
│   ├── index.css                ← Global styles
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MenuBar.tsx       ← Word-style menu
│   │   │   ├── Toolbar.tsx       ← Quick actions
│   │   │   ├── ExplorerPanel.tsx ← Left tree panel
│   │   │   └── ContentPanel.tsx  ← Right content area
│   │   └── ui/                  ← Reusable primitives
│   │       ├── Button.tsx
│   │       ├── TreeView.tsx
│   │       ├── CodePreview.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── ContextMenu.tsx
│   │       ├── Modal.tsx
│   │       └── Table.tsx
│   │
│   ├── modules/                 ← Satu folder per module
│   │   ├── welcome/WelcomePage.tsx
│   │   ├── explorer/ExplorerModule.tsx
│   │   ├── script-swapper/ScriptSwapperModule.tsx
│   │   ├── asset-forge/AssetForgeModule.tsx
│   │   ├── panel-studio/PanelStudioModule.tsx
│   │   ├── swf-builder/SwfBuilderModule.tsx
│   │   ├── game-data-editor/GameDataEditorModule.tsx
│   │   ├── amf-builder/AmfBuilderModule.tsx
│   │   ├── text-localizer/TextLocalizerModule.tsx
│   │   ├── mission-editor/MissionEditorModule.tsx
│   │   └── sound-studio/SoundStudioModule.tsx
│   │
│   ├── stores/                  ← State management
│   │   ├── app-store.ts         ← Global state (SWF, project, tab)
│   │   └── explorer-store.ts
│   │
│   ├── hooks/                   ← Custom React hooks
│   │   ├── useIpc.ts
│   │   ├── useSwf.ts
│   │   └── useContextMenu.ts
│   │
│   ├── lib/                     ← Pure functions (no React)
│   │   ├── ffdec-parser.ts      ← Parse CLI output → data
│   │   ├── swf-utils.ts         ← SWF analysis helpers
│   │   ├── file-utils.ts        ← File system helpers
│   │   └── formatters.ts        ← Format bytes, duration, etc.
│   │
│   ├── types/                   ← TypeScript definitions
│   │   ├── swf.ts
│   │   └── electron.d.ts
│   │
│   └── assets/icons/
│
├── shared/                      ← Shared main & renderer types
│   └── types.ts
│
└── resources/                   ← App icons
    ├── icon.ico
    ├── icon.png
    └── icon.icns
```

## Prinsip Desain

1. **Modular** — setiap module berdiri sendiri, komunikasi via store/IPC
2. **Context-driven** — action muncul di mana user berada (klik kanan)
3. **Shared service** — ffdec dipanggil dari satu service, semua module panggil itu
4. **Generic first** — tool bekerja untuk SWF apapun, NinjaSage adalah special case
