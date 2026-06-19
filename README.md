# 3D-Scan-Viewer & Vermessungs-Tool

Eine rein **client-seitige** Web-App (kein Backend), die 3D-Gebäudescans im Browser
lädt, **vermisst** (Strecken, Polylinien, Flächen) und über den ausgerichteten Scan
einen **2D-Grundriss mit Wänden, Türen und Fenstern** zeichnen lässt. Ergebnisse
lassen sich als **DXF / JSON / GLB / PNG** exportieren. Geteilt wird über Links –
Empfänger öffnen einen (optional read-only) Viewer und messen selbst.

Läuft vollständig statisch und ist für **GitHub Pages** vorbereitet.

---

## Schnellstart (lokal)

```bash
npm install
npm run gen:samples   # erzeugt Beispielmodelle in public/models (einmalig)
npm run dev           # Entwicklungsserver
```

Build & Vorschau:

```bash
npm run build
npm run preview
```

---

## ⚠️ GitHub-Pages base-Pfad anpassen

Der base-Pfad steht in [`vite.config.ts`](./vite.config.ts) und ist standardmäßig auf
**`/Slicer/`** gesetzt (exakt der Repository-Name – GitHub Pages liefert case-sensitiv aus).

- **Projekt-Page** `https://<user>.github.io/<REPO>/` → base = `'/<REPO>/'`
  (bei diesem Repo `Slicer`: `'/Slicer/'` – bereits korrekt; live unter
  `https://go2dach.github.io/Slicer/`).
- **User-/Org-Page oder Custom-Domain** (Auslieferung vom Domain-Root) → base = `'/'`.

Override beim Build ohne Datei-Änderung:

```bash
BASE_PATH=/ npm run build
```

Wenn du das Repo umbenennst, passe den Default in `vite.config.ts` an.

---

## Deployment auf GitHub Pages

1. Repo auf GitHub pushen.
2. In **Settings → Pages → Build and deployment → Source** auf **GitHub Actions** stellen.
3. Push auf `main` löst [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) aus
   (Build → `actions/upload-pages-artifact` → `actions/deploy-pages`).
4. Danach ist die App unter `https://<user>.github.io/<REPO>/` erreichbar.

---

## Modelle laden & teilen

Da es keinen Server-Upload gibt, gibt es drei Wege:

### 1. Drag & Drop (lokal, nicht teilbar)
Datei(en) ins Fenster ziehen. Unterstützt **STL, OBJ (+ MTL + Texturen), GLB/GLTF
(inkl. Draco/Meshopt), PLY**. Für OBJ-Sets alle zusammengehörigen Dateien (OBJ, MTL,
Bilder) **gemeinsam** ablegen – Referenzen werden über Blob-URLs aufgelöst.

### 2. `?model=`-Link (teilbar)
```
https://<user>.github.io/<REPO>/?model=models/haus.glb
```
- **Im Repo hosten:** Datei nach `public/models/` legen und committen → Pfad
  `models/datei.glb` (same-origin, keine CORS-Probleme).
- **GitHub Release** (für große Dateien): Asset hochladen, volle Asset-URL verwenden.
- **Externe URL:** beliebiger Host, der **CORS** erlaubt (z. B. `raw.githubusercontent.com`).
- Optional OBJ-MTL überschreiben: `&mtl=models/haus.mtl`.
- **Read-only-Modus:** `&view=readonly` → nur Ansehen/Messen, keine Editier-Tools.

### 3. Teilen-Helfer in der UI
Button **„Teilen"** öffnet einen Dialog, der die Hosting-Optionen erklärt und den
passenden Share-Link (inkl. Read-only-Variante) generiert und kopiert.

---

## Funktionen

| Modus | Inhalt |
|-------|--------|
| **Ansehen** | OrbitControls, Auto-Fit, Grid/Achsen, Reset, Modell-Infos (Dreiecke, Bounding-Box). |
| **Messen** | Punkte picken (BVH-beschleunigt), **Strecke**, **Polylinie**, **Polygonfläche** (Newell), **Kalibrierung** auf ein Referenzmaß. Labels + Mess-Liste, Undo, Löschen. |
| **Ausrichten** | 3 Bodenpunkte → Boden waagrecht (Quaternion). 2 Wandpunkte → Wand achsparallel. Anwenden/Zurücksetzen; Annotationen folgen der Ausrichtung. |
| **Zeichnen** | Orthografische Top-Down-Kamera, horizontaler **Schnitt** (Clipping-Planes), **Wände** auf Bodenebene zeichnen (Snapping: 45°/90°, Endpunkte), **Türen/Fenster** auf Wänden platzieren, editierbare Element-Liste. |
| **Export** | **DXF** (R12, maßhaltig), **JSON** (BIM-Modell), **GLB** (gezeichnetes Modell), **PNG** (Screenshot). |

### Kalibrierung (wichtig)
STL/OBJ/Photogrammetrie haben oft willkürliche Einheiten. Ohne Kalibrierung werden
Maße als Meter **angenommen und als „unkalibriert" markiert**. Über zwei Punkte mit
bekanntem realem Abstand wird ein globaler Maßstabsfaktor gesetzt; danach stimmen alle
weiteren Maße.

---

## Tastatur

- `Esc` – aktuelle Aktion abbrechen / Auswahl aufheben
- `Entf` / `Backspace` – Auswahl löschen
- `Ctrl/Cmd + Z` – Undo
- `Enter` – Polylinie/Polygon bzw. Wandkette abschließen

---

## Tech-Stack

Vite · React · TypeScript · three.js · @react-three/fiber · @react-three/drei ·
zustand · three-mesh-bvh (schnelles Raycasting) · DRACOLoader + MeshoptDecoder
(lokal gehostet unter `public/draco/`). DXF-Export als selbst geschriebener
R12-ASCII-Writer.

## Tests

```bash
node --experimental-strip-types scripts/unit.test.mts   # reine Logik (Geometrie/DXF/Einheiten)
# Headless-Smoke-Test (Build + laufender Preview-Server nötig):
npm run build && npm run preview &   # Server auf :4173
SMOKE_URL=http://127.0.0.1:4173/Slicer/ node scripts/smoke.mjs
```

Siehe [`DECISIONS.md`](./DECISIONS.md) für getroffene Design-Entscheidungen.
