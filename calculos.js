// Cálculos puros de la app (sin DOM). Probados en tools/test_calculos.mjs

export const NO_OPEX = new Set(['Crédito hipotecario', 'Compra', 'Trámites', 'Ahorro abono extra', 'Mejoras y dotación']);
export const ym = (f) => f.slice(0, 7);

export function porMes(movs) {
  const g = {};
  for (const m of movs) {
    const x = (g[ym(m.fecha)] ??= { ingresos: 0, arriendo: 0, gastos: 0, opex: 0, aporte: 0, n: 0 });
    x.n++;
    if (m.tipo === 'ingreso') { x.ingresos += m.valor; if (m.categoria === 'Arriendo') x.arriendo += m.valor; }
    else if (m.tipo === 'gasto') { x.gastos += m.valor; if (!NO_OPEX.has(m.categoria)) x.opex += m.valor; }
    else if (m.tipo === 'aporte') x.aporte += m.valor;
  }
  return g;
}

// Lo que ha puesto cada socio vs lo que le tocaría según su % (dif > 0: puso de más)
export function cuadre(socios, movs, hasta = '9999') {
  const puesto = Object.fromEntries(socios.map((s) => [s.id, 0]));
  let total = 0;
  for (const m of movs) {
    if (m.fecha >= hasta) continue;
    for (const [k, v] of Object.entries(m.aportes || {})) { puesto[k] = (puesto[k] || 0) + (+v || 0); total += +v || 0; }
  }
  return { total, socios: socios.map((s) => ({ ...s, puesto: puesto[s.id] || 0, dif: (puesto[s.id] || 0) - (total * s.pct) / 100 })) };
}

// Lee "1.300.000", "1,371,425.26", "1.371.425,26", "14,25", "15.25". Un solo separador seguido de 3 dígitos = miles.
export function leerValor(s) {
  s = String(s ?? '').trim();
  const neg = s.startsWith('-');
  s = s.replace(/[^\d,.]/g, '');
  if (!s) return 0;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) { const dec = lc > ld ? ',' : '.'; s = s.split(dec === ',' ? '.' : ',').join('').replace(',', '.'); }
  else for (const sep of [',', '.']) {
    if (!s.includes(sep)) continue;
    s = s.split(sep).length > 2 || new RegExp(`\\${sep}\\d{3}$`).test(s) ? s.split(sep).join('') : s.replace(sep, '.');
  }
  return (neg ? -1 : 1) * (Number(s) || 0);
}

export const tasaMes =(ea) => Math.pow(1 + ea / 100, 1 / 12) - 1;

// Amortización cuota constante desde el saldo actual; los abonos extra reducen plazo (Bancolombia por defecto)
export function proyeccion(c, abonoUnico = 0, abonoMes = 0) {
  const i = tasaMes(c.tasaEA);
  let s = c.saldo - abonoUnico, meses = 0, intereses = 0;
  while (s > 1 && meses < 600) {
    const int = s * i;
    s -= Math.min(c.cuotaSinSubsidio - int + abonoMes, s);
    intereses += int;
    meses++;
  }
  return { meses, intereses };
}

export function sumarMeses(f, n) {
  const [y, m] = f.split('-').map(Number), t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

// m² del apto según quién es dueño hoy: banco (saldo / valor) y el resto por % de cada socio
export function metros(area, valor, saldo, socios) {
  const banco = Math.min(area, Math.round((saldo / valor) * area || 0));
  let resto = area - banco;
  const cuotas = socios.map((s, k) => {
    const n = k === socios.length - 1 ? resto : Math.round(((area - banco) * s.pct) / 100);
    resto -= n;
    return { id: s.id, n };
  });
  return { banco, propios: area - banco, cuotas };
}

export function proximaFecha(r, hoy) {
  if (r.repite === 'no' || r.fecha >= hoy) return r.fecha;
  let f = r.fecha;
  const paso = r.repite === 'mensual' ? 1 : 12;
  while (f < hoy) f = sumarMeses(f, paso) + f.slice(7);
  return f;
}
