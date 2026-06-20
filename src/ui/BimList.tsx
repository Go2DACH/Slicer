import { useStore } from '../store';
import { rawDistance, netRawArea } from '../lib/geometry';
import { formatLength, formatArea } from '../lib/units';

function RoomsSummary() {
  const rooms = useStore((s) => s.rooms);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const selectRoom = useStore((s) => s.selectRoom);
  const removeRoom = useStore((s) => s.removeRoom);
  const renameRoom = useStore((s) => s.renameRoom);

  if (rooms.length === 0) return null;
  const others = (id: string) => rooms.filter((r) => r.id !== id);
  const rawTotal = rooms.reduce((acc, r) => acc + netRawArea(r.points, others(r.id)), 0);

  return (
    <div style={{ marginBottom: 12 }}>
      <h3>Räume ({rooms.length})</h3>
      {rooms.map((r) => (
        <div key={r.id} className={`list-item${selectedRoomId === r.id ? ' selected' : ''}`} onClick={() => selectRoom(r.id)}>
          <div className="meta">
            <input
              className="name"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              value={r.name}
              onChange={(e) => renameRoom(r.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="sub mono">{formatArea(netRawArea(r.points, others(r.id)), scaleFactor, unit)}</div>
          </div>
          <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); removeRoom(r.id); }}>
            ✕
          </button>
        </div>
      ))}
      <div className="card" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted">Gesamtfläche</span>
        <span className="mono" style={{ fontWeight: 700 }}>{formatArea(rawTotal, scaleFactor, unit)}</span>
      </div>
    </div>
  );
}

export default function BimList() {
  const walls = useStore((s) => s.walls);
  const openings = useStore((s) => s.openings);
  const rooms = useStore((s) => s.rooms);
  const scaleFactor = useStore((s) => s.scaleFactor);
  const unit = useStore((s) => s.unit);
  const selectedWallId = useStore((s) => s.selectedWallId);
  const selectedOpeningId = useStore((s) => s.selectedOpeningId);
  const selectWall = useStore((s) => s.selectWall);
  const selectOpening = useStore((s) => s.selectOpening);
  const removeWall = useStore((s) => s.removeWall);
  const removeOpening = useStore((s) => s.removeOpening);
  const renameWall = useStore((s) => s.renameWall);
  const updateWall = useStore((s) => s.updateWall);
  const updateOpening = useStore((s) => s.updateOpening);

  if (walls.length === 0 && openings.length === 0 && rooms.length === 0) {
    return (
      <div>
        <h3>Grundriss-Elemente</h3>
        <div className="muted small">Noch keine Wände gezeichnet.</div>
      </div>
    );
  }

  return (
    <div>
      <RoomsSummary />
      <h3>
        Grundriss-Elemente ({walls.length} Wände, {openings.length} Öffnungen)
      </h3>
      {walls.map((w) => {
        const len = formatLength(rawDistance(w.start, w.end), scaleFactor, unit);
        const wallOpenings = openings.filter((o) => o.wallId === w.id);
        return (
          <div key={w.id} style={{ marginBottom: 8 }}>
            <div className={`list-item${selectedWallId === w.id ? ' selected' : ''}`} onClick={() => selectWall(w.id)}>
              <div className="meta">
                <input
                  className="name"
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                  value={w.name}
                  onChange={(e) => renameWall(w.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="sub mono">
                  L {len} · D {w.thickness}
                  {unit} · H {w.height}
                  {unit}
                </div>
              </div>
              <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); removeWall(w.id); }}>
                ✕
              </button>
            </div>
            {selectedWallId === w.id && (
              <div className="card" style={{ marginTop: 4 }}>
                <div className="field-row">
                  <div className="field">
                    <label>Dicke ({unit})</label>
                    <input
                      type="number"
                      step={0.05}
                      value={w.thickness}
                      onChange={(e) => updateWall(w.id, { thickness: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="field">
                    <label>Höhe ({unit})</label>
                    <input
                      type="number"
                      step={0.1}
                      value={w.height}
                      onChange={(e) => updateWall(w.id, { height: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            )}
            {wallOpenings.map((o) => (
              <div key={o.id} style={{ marginLeft: 14 }}>
                <div
                  className={`list-item${selectedOpeningId === o.id ? ' selected' : ''}`}
                  onClick={() => selectOpening(o.id)}
                >
                  <div className="meta">
                    <div className="name">
                      {o.type === 'door' ? '🚪' : '🪟'} {o.name}
                    </div>
                    <div className="sub mono">
                      B {o.width}
                      {unit} · H {o.height}
                      {unit}
                      {o.type === 'window' ? ` · Brüstung ${o.sill}${unit}` : ''}
                    </div>
                  </div>
                  <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); removeOpening(o.id); }}>
                    ✕
                  </button>
                </div>
                {selectedOpeningId === o.id && (
                  <div className="card" style={{ marginTop: 4 }}>
                    <div className="field-row">
                      <div className="field">
                        <label>Breite ({unit})</label>
                        <input
                          type="number"
                          step={0.05}
                          value={o.width}
                          onChange={(e) => updateOpening(o.id, { width: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="field">
                        <label>Höhe ({unit})</label>
                        <input
                          type="number"
                          step={0.05}
                          value={o.height}
                          onChange={(e) => updateOpening(o.id, { height: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    {o.type === 'window' && (
                      <div className="field" style={{ marginTop: 8 }}>
                        <label>Brüstungshöhe ({unit})</label>
                        <input
                          type="number"
                          step={0.05}
                          value={o.sill}
                          onChange={(e) => updateOpening(o.id, { sill: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                    <button
                      style={{ marginTop: 8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOpening(o.id, { flip: !o.flip });
                      }}
                    >
                      ⇄ Öffnungsrichtung umkehren
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
