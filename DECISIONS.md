# Design-Entscheidungen

Dokumentiert die wichtigsten Entscheidungen, die während der autonomen Umsetzung
getroffen wurden.

## Stack & Versionen
- **React 18 + @react-three/fiber 8 + @react-three/drei 9** (statt r3f 9 / React 19),
  weil dieses Set die ausgereifteste, am besten dokumentierte und untereinander
  kompatible Kombination ist.
- **three 0.169** mit **three-mesh-bvh 0.8.3** (top-level) für BVH-Raycasting.
  drei bringt intern noch 0.7.8 mit – beide sind mit three 0.169 kompatibel; unsere
  eigenen Imports nutzen 0.8.3.
- **TypeScript**: Eine einzige `tsconfig.json` (kein Project-Reference-Split), um den
  TS6310-Konflikt (`composite` + `noEmit`) zu vermeiden. Build = `tsc && vite build`.

## Koordinaten-Frames
- **Picking & Annotationen leben im Welt-Raum.** Klicks liefern Welt-Koordinaten
  (r3f `event.point`), die direkt gespeichert werden.
- Das Modell liegt in einer Gruppe mit der **Ausrichtungs-Transform** (Quaternion +
  Y-Offset). Beim Anwenden/Zurücksetzen einer Ausrichtung wird eine **Delta-Transform**
  auf alle bestehenden Annotationen (Messungen, Wände, Pending-Punkte) angewendet,
  damit diese am Modell „kleben". So ist die Reihenfolge Messen↔Ausrichten unkritisch.
- **Y-up-Konvention:** Boden = XZ-Ebene, Höhe = Y. Nach der Boden-Ausrichtung liegt der
  Boden bei `Y = 0`; darauf wird im Zeichenmodus gezeichnet. DXF mappt Welt-`(x, z)` →
  DXF-`(x, -z)`, damit der Plan aufrecht erscheint.

## Maßstab / Kalibrierung
- Globaler `scaleFactor` (real = roh × scaleFactor). Default 1, Flag `calibrated=false`,
  UI zeigt „unkalibriert" und nimmt Meter an. Kalibrierung über zwei Referenzpunkte +
  bekanntem Maß ist Kernfunktion.

## Raycasting-Performance
- `three-mesh-bvh` patcht `Mesh.prototype.raycast` global; BVH wird nach dem Laden auf
  alle Mesh-Geometrien gebaut. Ohne BVH gebaute Geometrien fallen automatisch auf den
  Standard-Raycast zurück (kein Fehler).

## Loader
- **OBJ-Multi-File:** `LoadingManager.setURLModifier` löst referenzierte Dateinamen
  (MTL, Texturen) über eine Basename→Blob-URL-Map aus dem Drag&Drop-Set auf.
- **Draco/Meshopt:** Draco-Decoder werden **lokal** unter `public/draco/` gehostet
  (Pfad relativ zu `import.meta.env.BASE_URL`), Meshopt-Decoder ist als ES-Modul
  gebündelt – keine Abhängigkeit von fremden CDNs.
- **CORS:** Same-origin (`public/models/`) ist problemlos. Bei externen URLs wird ein
  Cross-Origin-/Netzwerkfehler als klare Meldung „Quelle erlaubt kein Cross-Origin-Laden"
  angezeigt.
- Geometrie-Formate (STL/PLY) erhalten ein neutrales, **doppelseitiges**
  `MeshStandardMaterial` (Scans haben oft inkonsistente Normalen).

## Schnitt (Section)
- Horizontaler Schnitt über **zwei Clipping-Planes**, die einen dünnen Slab um die
  Schnitthöhe bilden (`localClippingEnabled = true`). So entsteht eine saubere
  Schnittkontur als Zeichenhilfe. Schnitthöhe ist real (m) und wird via scaleFactor in
  Roh-Einheiten umgerechnet.

## Türen/Fenster (v1)
- Öffnungen werden als **markierte Volumen** (halbtransparente Boxen) auf der Wand
  dargestellt, nicht via CSG subtrahiert. `three-bvh-csg` ist als Dependency vorhanden;
  echtes CSG-Subtrahieren ist als spätere Option vorgesehen. Im DXF werden Öffnungen als
  eigene Polylinien-Rechtecke + Text auf Layer `OPENINGS` ausgegeben.

## DXF-Export
- Eigener **R12 (AC1009) ASCII-Writer** statt externer Library – maximale CAD-
  Kompatibilität mit `LINE`, `POLYLINE`, `TEXT` und einer `LAYER`-Tabelle. Wände als
  geschlossene Footprint-Polylinien + Mittellinie, Maßtexte auf Layer `DIMS`,
  `$INSUNITS = 6` (Meter).

## Sharing-Modell
- Kein Upload möglich → drei Wege: Drag&Drop (lokal), `?model=`-Link (gehostet im Repo
  oder extern mit CORS), Teilen-Dialog generiert Links inkl. `&view=readonly`.
- **SPA-State** liegt in Query-Parametern; Asset-Pfade relativ zum base → kein 404 bei
  Refresh.

## Beispielmodelle
- `scripts/genSamples.mjs` erzeugt einen prozeduralen Raum (5×4 m, 2,6 m hoch, mit Tür-
  und Fensteröffnung sowie Tisch) als **GLB, STL und PLY** sowie ein texturiertes
  **OBJ+MTL+PNG**-Set (selbst geschriebener PNG-Encoder via `zlib`). GLTF-/PLY-Exporter
  laufen in Node mit kleinen Polyfills (`FileReader`, `requestAnimationFrame`).

## Tests
- **Headless-Smoke-Test** (Puppeteer + SwiftShader) lädt das Demo-Modell, prüft
  Triangle-Count, Kalibrierung, Messung, Zeichnen, dass der Canvas tatsächlich rendert
  und 0 Konsolen-Fehler auftreten.
- **Unit-Tests** (Node strip-types) decken Geometrie, Einheiten-Formatierung und DXF ab.
- Alle vier Lade-Formate (GLB/STL/PLY/OBJ) wurden im Browser real verifiziert.
