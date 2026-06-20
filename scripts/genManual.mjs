// Generates the German user manual PDF into public/anleitung.pdf.
// Run with: npm run gen:manual
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'anleitung.pdf');

const ACCENT = '#2f5bb0';
const TEXT = '#1a1a1a';
const MUTED = '#555555';

const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: '3D-Scan-Viewer – Anleitung' } });
doc.pipe(createWriteStream(outFile));

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

function h1(t) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(15).text(t);
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.x + W, doc.y + 2).strokeColor(ACCENT).lineWidth(0.7).stroke();
  doc.moveDown(0.4);
  doc.fillColor(TEXT).font('Helvetica').fontSize(10.5);
}
function para(t) {
  doc.fillColor(TEXT).font('Helvetica').fontSize(10.5).text(t, { width: W, lineGap: 1.5 });
  doc.moveDown(0.3);
}
function bullets(items) {
  doc.fillColor(TEXT).font('Helvetica').fontSize(10.5);
  for (const it of items) {
    const startY = doc.y;
    doc.text('•', doc.page.margins.left, startY, { width: 12, continued: false });
    doc.text(it, doc.page.margins.left + 14, startY, { width: W - 14, lineGap: 1.2 });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.2);
}
function step(items) {
  doc.fillColor(TEXT).font('Helvetica').fontSize(10.5);
  let n = 1;
  for (const it of items) {
    const startY = doc.y;
    doc.font('Helvetica-Bold').text(`${n}.`, doc.page.margins.left, startY, { width: 16 });
    doc.font('Helvetica').text(it, doc.page.margins.left + 18, startY, { width: W - 18, lineGap: 1.2 });
    doc.moveDown(0.2);
    n++;
  }
  doc.moveDown(0.2);
}

// ---- Title ----
doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(24).text('3D-Scan-Viewer & Vermessung');
doc.fillColor(MUTED).font('Helvetica').fontSize(12).text('Bedienungsanleitung – Messen, Ausrichten & Grundriss zeichnen im Browser');
doc.moveDown(0.3);
doc.fillColor(MUTED).fontSize(9).text('Web-App (ohne Installation): https://go2dach.github.io/Slicer/   ·   optimiert für Touch (Smartphone, Tablet, Galaxy Fold).');
doc.moveDown(0.2);

h1('1 · Überblick');
para(
  'Mit dieser App lädst du einen 3D-Scan eines Gebäudes, vermisst Strecken und Flächen, richtest das Modell waagrecht aus und zeichnest darüber einen 2D-Grundriss mit Wänden, Türen und Fenstern. Ergebnisse kannst du als DXF (CAD), JSON, GLB oder PNG exportieren und per Link teilen. Alles läuft lokal im Browser – es werden keine Daten hochgeladen.',
);

h1('2 · Modell laden');
bullets([
  'Per Drag & Drop: Datei(en) ins Fenster ziehen. Auf dem Handy/Tablet: „Datei öffnen“ in der oberen Leiste.',
  'Unterstützt: STL, OBJ (+ MTL + Texturen), GLB/GLTF (auch Draco/Meshopt), PLY.',
  'Farbige Punktwolken: PLY, PCD, XYZ.',
  'OBJ-Sets: OBJ, MTL und Bilddateien zusammen auswählen/ablegen.',
  'Per Link teilbar: …?model=models/haus.glb (Datei im Repo unter public/models/ ablegen).',
]);

h1('3 · Maßstab kalibrieren (wichtig!)');
para(
  'Viele Scans haben keine echten Einheiten. STL-Dateien sind fast immer in Millimeter (3D-Druck-Standard) – ohne Kalibrierung wirkt z. B. ein 60-mm-Objekt 60 m groß.',
);
step([
  'Modus „Messen“ wählen, dann „Jetzt kalibrieren“ (oder das Feld „unkalibriert“ oben).',
  'Schnell: „Modell ist in“ mm/cm/m/Zoll wählen und „Anzeige in“ festlegen – fertig.',
  'Alternativ per Referenzmaß: zwei Punkte mit bekanntem Abstand antippen und den echten Wert eingeben.',
]);

h1('4 · Navigation & Ansichten');
bullets([
  'Maus: linke Taste dreht (3D) bzw. schiebt (Draufsicht), Rad zoomt, rechte Taste schiebt.',
  'Touch: 1 Finger dreht (3D) / schiebt (Draufsicht), 2 Finger ziehen = Zoom & Verschieben. Kurzer Tipp = Punkt setzen.',
  'Ansicht-Buttons: 3D · Oben (Draufsicht) · Unten (Untersicht). „Reset“ zentriert das Modell.',
  'Begehung: First-Person durch das Modell laufen (am Desktop mit Maus + WASD).',
]);

h1('5 · Touch-Bedienung (Smartphone, Tablet, Galaxy Fold)');
bullets([
  'Mit ☰ (oben rechts) blendest du das Seitenpanel ein/aus – auf kleinen/faltbaren Displays ist es ein Overlay, damit die 3D-Fläche groß bleibt.',
  'Die runde Aktionsleiste unten im Bild ersetzt die Tastatur: „Fertig/Kette beenden“, „Abbrechen“, „Löschen“, „Undo (↶)“.',
  'Punkt vs. Verschieben: ein kurzer Tipp setzt einen Punkt, ein Ziehen verschiebt/dreht die Ansicht.',
  'Tipp am Galaxy Fold: im aufgeklappten Innendisplay quer arbeiten; Panel bei Bedarf mit ☰ schließen.',
]);

h1('6 · Vermessen');
bullets([
  'Strecke: zwei Punkte – Länge erscheint als Label.',
  'Polylinie: mehrere Punkte – Gesamtlänge; mit „Fertig“ (oder Enter) abschließen.',
  'Fläche: Punkte eines Polygons – Flächeninhalt in m²; mit „Fertig“ schließen.',
  'Alle Messungen erscheinen in der Liste und lassen sich umbenennen, einzeln löschen oder per Undo zurücknehmen.',
]);

h1('7 · Ausrichten (Boden waagrecht)');
step([
  'Modus „Ausrichten“ → „Boden (3 Punkte)“.',
  'Drei Punkte auf dem Boden antippen – die Ausrichtung erfolgt automatisch und springt in die Draufsicht.',
  'Optional „Wand (2 Punkte)“: zwei Punkte entlang einer Wand, damit eine Wand achsparallel liegt.',
  '„Zurücksetzen“ macht die Ausrichtung rückgängig.',
]);

h1('8 · Grundriss zeichnen');
para('Im Modus „Zeichnen“ stehen zwei Werkzeuge zur Verfügung:');
bullets([
  'Wände (Punkte): nacheinander Eckpunkte tippen; tippst du wieder auf den Startpunkt, schließt sich der Raum und die m²-Fläche erscheint sofort.',
  'Rechteck-Raum: zwei gegenüberliegende Ecken tippen – ein kompletter Raum (4 Wände + Fläche) in einem Schritt.',
]);
para('Fangen / Raster (für saubere Kanten):');
bullets([
  'Punkt fangen: rastet an vorhandenen Endpunkten ein und schließt Räume.',
  'Fläche fangen: zeichnet direkt auf der Scan-Oberfläche.',
  'Winkel-Raster: neue Wände rasten bei 30/45/70/90/120/180° ein.',
  'Längen-Raster: Wandlänge rastet in festen Schritten (5/10/25/50 cm).',
]);
para('Wände: Stärke per Preset (Dünn 10 / Standard 20 / Dick 36 cm) oder frei. Höhe einstellbar.');

h1('9 · Türen & Fenster');
bullets([
  'Nur auf Wänden platzierbar: „Tür setzen“ bzw. „Fenster setzen“, dann auf eine vorhandene Wand tippen.',
  'Die Öffnung schneidet eine sichtbare Lücke in die Wand (Tür = volle Höhe, Fenster = zwischen Brüstung und Sturz) mit Schwungbogen-Symbol.',
  'Breiten-Presets: Türen 80/100/120 cm, Fenster 40/80/120 cm (oder frei).',
  'Öffnungsrichtung standardmäßig nach innen; mit „Öffnungsrichtung umkehren“ (global oder pro Element) drehbar.',
]);

h1('10 · Räume & Flächen');
bullets([
  'Jeder geschlossene Raum zeigt seine Fläche in m² direkt im Grundriss.',
  'Die Räume-Liste summiert alle Flächen zu einer Gesamtfläche.',
  'Raum-im-Raum: liegt ein Raum vollständig in einem anderen, wird seine Fläche vom äußeren abgezogen (Netto-Fläche).',
]);

h1('11 · Export & Teilen');
bullets([
  'DXF: maßhaltiger Grundriss für CAD (Wände, Öffnungen, Maßtexte; Einheit wird übernommen).',
  'JSON: das BIM-Modell (Wände/Öffnungen mit Maßen).',
  'GLB: das gezeichnete Modell in 3D. PNG: Screenshot der aktuellen Ansicht.',
  'Teilen: Link erzeugen (optional „Read-only“) – Empfänger können ansehen und messen.',
]);

h1('12 · Tastatur (Desktop)');
bullets([
  'Esc: aktuelle Aktion abbrechen / Auswahl aufheben.',
  'Entf / Backspace: Auswahl löschen.',
  'Strg/Cmd + Z: Undo.',
  'Enter: Polylinie/Polygon bzw. Wandkette abschließen.',
]);

doc.moveDown(0.6);
doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8.5).text(
  'Auf Touch-Geräten sind alle Tastatur-Aktionen über die runde Aktionsleiste unten im Bild erreichbar.',
  { width: W },
);

doc.end();
console.log('anleitung.pdf geschrieben:', outFile);
