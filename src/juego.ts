export const CONFIG = {
  filas: 5, // filas
  columnas: 5, // columnas
  familiasMinimas: 1, // familias por zona
  familiasMaximas: 3, // familias por zona
  aguaInicialMinima: 0, // unidades de agua
  aguaInicialMaxima: 3, // unidades de agua
  aguaParaInundarse: 6, // unidades de agua
  lluviaZonaNormal: 1, // unidades de agua por turno
  lluviaQuebrada: 2, // unidades de agua por turno
  drenajeZona: 3, // unidades de agua
  drenajeZonaVecina: 1, // unidades de agua
  accionesPorTurno: 3, // acciones por turno
  turnosMaximos: 8, // turnos
  porcentajeMeta: 70, // porcentaje de familias
} as const

export type Zona = {
  fila: number
  columna: number
  familias: number
  agua: number
  estado: 'enRiesgo' | 'inundada' | 'evacuada'
}

export type Estado = {
  zonas: Zona[]
  turno: number
  accionesRestantes: number
  familiasSalvas: number
  familiasPerdidas: number
  totalFamilias: number
  resultado: 'enCurso' | 'ganada' | 'perdida'
}

type EstadoPlan = {
  aguas: number[]
  estados: Zona['estado'][]
  familias: number[]
  familiasSalvas: number
  turno: number
  accionesRestantes: number
}

export function crearGeneradorAleatorio(semilla: number): () => number {
  let estado = Math.trunc(semilla) >>> 0

  return () => {
    estado += 0x6d2b79f5
    let valor = estado
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1)
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61)
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296
  }
}

function numeroAleatorioEntero(aleatorio: () => number, minimo: number, maximo: number): number {
  return minimo + Math.floor(aleatorio() * (maximo - minimo + 1))
}

function obtenerVecinas(indice: number): number[] {
  const fila = Math.floor(indice / CONFIG.columnas)
  const columna = indice % CONFIG.columnas
  const vecinas: number[] = []

  if (fila > 0) vecinas.push(indice - CONFIG.columnas)
  if (fila < CONFIG.filas - 1) vecinas.push(indice + CONFIG.columnas)
  if (columna > 0) vecinas.push(indice - 1)
  if (columna < CONFIG.columnas - 1) vecinas.push(indice + 1)

  return vecinas
}

function familiasEnRiesgo(estado: Estado): number {
  return estado.zonas.reduce(
    (total, zona) => total + (zona.estado === 'enRiesgo' ? zona.familias : 0),
    0,
  )
}

function cantidadMeta(estado: Estado): number {
  return Math.ceil((estado.totalFamilias * CONFIG.porcentajeMeta) / 100)
}

function aplicarLluvia(aguas: number[], estados: Zona['estado'][]): void {
  for (let indice = 0; indice < aguas.length; indice += 1) {
    const fila = Math.floor(indice / CONFIG.columnas)
    aguas[indice] += fila === CONFIG.filas - 1
      ? CONFIG.lluviaQuebrada
      : CONFIG.lluviaZonaNormal

    if (estados[indice] === 'enRiesgo' && aguas[indice] >= CONFIG.aguaParaInundarse) {
      estados[indice] = 'inundada'
    }
  }
}

function puedeAlcanzarMeta(estado: Estado): boolean {
  const meta = cantidadMeta(estado)
  const planInicial: EstadoPlan = {
    aguas: estado.zonas.map((zona) => zona.agua),
    estados: estado.zonas.map((zona) => zona.estado),
    familias: estado.zonas.map((zona) => zona.familias),
    familiasSalvas: estado.familiasSalvas,
    turno: estado.turno,
    accionesRestantes: estado.accionesRestantes,
  }
  const visitados = new Set<string>()

  function buscar(plan: EstadoPlan): boolean {
    if (plan.familiasSalvas >= meta) return true

    const familiasPosibles = plan.estados.reduce(
      (total, situacion, indice) => total + (situacion === 'enRiesgo' ? plan.familias[indice] : 0),
      plan.familiasSalvas,
    )
    if (familiasPosibles < meta || plan.turno > CONFIG.turnosMaximos) return false

    const accionesDisponibles = plan.accionesRestantes
      + (CONFIG.turnosMaximos - plan.turno) * CONFIG.accionesPorTurno
    const familiasPorZona = plan.estados
      .map((situacion, indice) => situacion === 'enRiesgo' ? plan.familias[indice] : 0)
      .sort((a, b) => b - a)
    const maximoPorAcciones = familiasPorZona
      .slice(0, accionesDisponibles)
      .reduce((total, familias) => total + familias, plan.familiasSalvas)
    if (maximoPorAcciones < meta) return false

    const clave = `${plan.turno}|${plan.accionesRestantes}|${plan.familiasSalvas}|${plan.aguas.join(',')}|${plan.estados.join(',')}`
    if (visitados.has(clave)) return false
    visitados.add(clave)

    const cerrarTurno = (): boolean => {
      const aguas = [...plan.aguas]
      const estados = [...plan.estados]
      aplicarLluvia(aguas, estados)

      if (plan.turno === CONFIG.turnosMaximos) return plan.familiasSalvas >= meta

      return buscar({
        aguas,
        estados,
        familias: plan.familias,
        familiasSalvas: plan.familiasSalvas,
        turno: plan.turno + 1,
        accionesRestantes: CONFIG.accionesPorTurno,
      })
    }

    if (plan.accionesRestantes === 0) return cerrarTurno()

    const zonasParaEvacuar = plan.estados
      .map((situacion, indice) => ({ situacion, indice, familias: plan.familias[indice] }))
      .filter((zona) => zona.situacion === 'enRiesgo')
      .sort((a, b) => b.familias - a.familias)

    for (const zona of zonasParaEvacuar) {
      const estados = [...plan.estados]
      estados[zona.indice] = 'evacuada'
      if (buscar({
        ...plan,
        estados,
        familiasSalvas: plan.familiasSalvas + zona.familias,
        accionesRestantes: plan.accionesRestantes - 1,
      })) return true
    }

    for (let indice = 0; indice < plan.aguas.length; indice += 1) {
      const reducciones = new Map<number, number>()
      reducciones.set(indice, CONFIG.drenajeZona)
      for (const vecina of obtenerVecinas(indice)) {
        reducciones.set(vecina, CONFIG.drenajeZonaVecina)
      }

      const aguas = [...plan.aguas]
      let reduceZonaEnRiesgo = false
      for (const [indiceReducido, reduccion] of reducciones) {
        const aguaNueva = Math.max(0, aguas[indiceReducido] - reduccion)
        if (plan.estados[indiceReducido] === 'enRiesgo' && aguaNueva < aguas[indiceReducido]) {
          reduceZonaEnRiesgo = true
        }
        aguas[indiceReducido] = aguaNueva
      }

      if (!reduceZonaEnRiesgo) continue
      if (buscar({ ...plan, aguas, accionesRestantes: plan.accionesRestantes - 1 })) return true
    }

    return cerrarTurno()
  }

  return buscar(planInicial)
}

function actualizarResultado(estado: Estado): void {
  if (estado.familiasSalvas >= cantidadMeta(estado)) {
    estado.resultado = 'ganada'
  } else if (!puedeAlcanzarMeta(estado)) {
    estado.resultado = 'perdida'
  }
}

export function crearEstado(semilla: number): Estado {
  const aleatorio = crearGeneradorAleatorio(semilla)
  const zonas: Zona[] = []

  for (let fila = 0; fila < CONFIG.filas; fila += 1) {
    for (let columna = 0; columna < CONFIG.columnas; columna += 1) {
      zonas.push({
        fila,
        columna,
        familias: numeroAleatorioEntero(aleatorio, CONFIG.familiasMinimas, CONFIG.familiasMaximas),
        agua: numeroAleatorioEntero(aleatorio, CONFIG.aguaInicialMinima, CONFIG.aguaInicialMaxima),
        estado: 'enRiesgo',
      })
    }
  }

  return {
    zonas,
    turno: 1,
    accionesRestantes: CONFIG.accionesPorTurno,
    familiasSalvas: 0,
    familiasPerdidas: 0,
    totalFamilias: zonas.reduce((total, zona) => total + zona.familias, 0),
    resultado: 'enCurso',
  }
}

export function avisar(estado: Estado, indiceZona: number): boolean {
  const zona = estado.zonas[indiceZona]
  if (
    estado.resultado !== 'enCurso'
    || estado.accionesRestantes <= 0
    || zona === undefined
    || zona.estado !== 'enRiesgo'
  ) return false

  zona.estado = 'evacuada'
  estado.familiasSalvas += zona.familias
  estado.accionesRestantes -= 1
  actualizarResultado(estado)
  return true
}

export function drenar(estado: Estado, indiceZona: number): boolean {
  if (
    estado.resultado !== 'enCurso'
    || estado.accionesRestantes <= 0
    || estado.zonas[indiceZona] === undefined
  ) return false

  const indices = new Map<number, number>()
  indices.set(indiceZona, CONFIG.drenajeZona)
  for (const vecina of obtenerVecinas(indiceZona)) {
    indices.set(vecina, CONFIG.drenajeZonaVecina)
  }

  for (const [indice, reduccion] of indices) {
    estado.zonas[indice].agua = Math.max(0, estado.zonas[indice].agua - reduccion)
  }

  estado.accionesRestantes -= 1
  actualizarResultado(estado)
  return true
}

export function terminarTurno(estado: Estado): boolean {
  if (estado.resultado !== 'enCurso') return false

  for (const zona of estado.zonas) {
    zona.agua += zona.fila === CONFIG.filas - 1
      ? CONFIG.lluviaQuebrada
      : CONFIG.lluviaZonaNormal

    if (zona.estado === 'enRiesgo' && zona.agua >= CONFIG.aguaParaInundarse) {
      zona.estado = 'inundada'
      estado.familiasPerdidas += zona.familias
    }
  }

  if (estado.turno === CONFIG.turnosMaximos) {
    actualizarResultado(estado)
  } else {
    estado.turno += 1
    estado.accionesRestantes = CONFIG.accionesPorTurno
    actualizarResultado(estado)
  }

  return true
}

export function obtenerFamiliasEnRiesgo(estado: Estado): number {
  return familiasEnRiesgo(estado)
}

export function obtenerPorcentajeMeta(estado: Estado): number {
  return (estado.familiasSalvas / estado.totalFamilias) * 100
}