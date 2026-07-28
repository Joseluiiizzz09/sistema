// Celda compacta "OBS. SEGUIMIENTO" reutilizada en Asesor/Supervisor/Jefatura.
// Agrupa tramo/comentario/motivo de Seguimiento en una sola columna,
// consistente con la posición ESTADO | OBS. SEGUIMIENTO | FECHA en las 3 vistas.
export default function ObsSeguimientoCell({ tramo, comentario, motivo }) {
  if (!tramo && !comentario && !motivo) {
    return <span style={{ color: '#9ca3af' }}>—</span>
  }
  return (
    <div style={{ fontSize: 10, lineHeight: 1.5, minWidth: 140, maxWidth: 200 }}>
      {tramo && (
        <div><span style={{ fontWeight: 700, color: '#6b7280' }}>Tramo:</span> {tramo}</div>
      )}
      {comentario && (
        <div
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={comentario}
        >
          <span style={{ fontWeight: 700, color: '#6b7280' }}>Comentario:</span> {comentario}
        </div>
      )}
      {motivo && (
        <div><span style={{ fontWeight: 700, color: '#6b7280' }}>Motivo:</span> {motivo}</div>
      )}
    </div>
  )
}
