import { useRef } from 'react';

interface Props {
  onPickFiles: (files: File[]) => void;
  onLoadSample: () => void;
}

export default function DropHint({ onPickFiles, onLoadSample }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="dropzone-hint">
      <div className="big">3D-Scan hierher ziehen</div>
      <div className="formats">
        Unterstützt: <b>STL</b>, <b>OBJ</b> (+ MTL + Texturen), <b>GLB/GLTF</b> (Draco/Meshopt), <b>PLY</b>
      </div>
      <div className="formats">
        Farbige <b>Punktwolken</b>: <b>PLY</b>, <b>PCD</b>, <b>XYZ</b>
      </div>
      <div className="formats small">OBJ-Sets: OBJ, MTL und Bilddateien zusammen ablegen.</div>
      <div className="row cta" style={{ marginTop: 8 }}>
        <button className="active" onClick={() => input.current?.click()}>
          Datei auswählen
        </button>
        <button onClick={onLoadSample}>Beispielmodell laden</button>
      </div>
      <div className="formats small muted" style={{ marginTop: 8 }}>
        Oder per Link: <span className="mono">?model=models/haus.glb</span>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept=".stl,.obj,.mtl,.ply,.glb,.gltf,.pcd,.xyz,.png,.jpg,.jpeg,.bmp,.bin"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPickFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
