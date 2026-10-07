/**
 * Distancias aproximadas por ruta (km) desde la planta a cada localidad.
 * Cargá acá las localidades habituales (en minúsculas, sin tildes) para que
 * el kilometraje del flete se complete solo. Si no está, se carga a mano.
 */
const DISTANCIAS_DESDE_PLANTA: Record<string, number> = {
  // 'rosario': 300,
};

/**
 * Retorna la distancia en km desde la planta a la localidad dada.
 * Normaliza el texto para coincidir con variaciones de escritura.
 * Retorna null si no se encuentra la localidad.
 */
export function calcularDistanciaDesdePlanta(localidad?: string | null): number | null {
  if (!localidad) return null;

  const normalizado = localidad
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar tildes
    .trim();

  if (DISTANCIAS_DESDE_PLANTA[normalizado] !== undefined) {
    return DISTANCIAS_DESDE_PLANTA[normalizado];
  }

  for (const [ciudad, km] of Object.entries(DISTANCIAS_DESDE_PLANTA)) {
    if (normalizado.includes(ciudad) || ciudad.includes(normalizado)) {
      return km;
    }
  }

  return null;
}
