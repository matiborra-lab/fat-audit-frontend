// El sistema propone (pre-selecciona) los items críticos o con un resultado
// deficiente, para agilizar la elección de un seguimiento - el admin/
// auditor/gerente igual puede desmarcar o sumar cualquier otro a mano.
// OPCION_MULTIPLE/NUMERO/TEXTO/FECHA no se auto-proponen (no hay forma
// genérica de saber si "salió mal"), pero se pueden marcar igual.
// Compartido por HistorialDetalle.jsx y el seguimiento programado desde
// Calendario.jsx - misma regla en los dos puntos de entrada.
export function esHallazgo(item, resp) {
  if (item.critico) return true;
  if (!resp || resp.no_aplica || resp.valor_json == null) return false;
  const v = resp.valor_json;
  if (item.tipo_respuesta === 'SI_NO') return !(v === 'SI' || v === true);
  if (item.tipo_respuesta === 'CHECKBOX') return !v;
  if (item.tipo_respuesta === 'ESCALA_5') return Number(v) <= 2;
  if (item.tipo_respuesta === 'ESCALA_10') return Number(v) <= 5;
  return false;
}
