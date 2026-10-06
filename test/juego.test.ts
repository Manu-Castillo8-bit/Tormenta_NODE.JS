import { describe, expect, it } from 'vitest'
import {
  avisar,
  CONFIG,
  crearEstado,
  drenar,
  obtenerFamiliasEnRiesgo,
  obtenerPorcentajeMeta,
  terminarTurno,
} from '../src/juego'
import type { Estado } from '../src/juego'

function crearEstadoDePrueba(): Estado {
  const estado = crearEstado(1)

  for (const zona of estado.zonas) {
    zona.familias = 1
    zona.agua = 0
    zona.estado = 'enRiesgo'
  }

  estado.totalFamilias = estado.zonas.reduce((total, zona) => total + zona.familias, 0)
  estado.familiasSalvas = 0
  estado.familiasPerdidas = 0
  estado.turno = 1
  estado.accionesRestantes = CONFIG.accionesPorTurno
  estado.resultado = 'enCurso'
  return estado
}

describe('la creación del tablero', () => {
  it('debe crear 25 zonas con familias y agua dentro de sus límites', () => {
    const estado = crearEstado(1)

    expect(estado.zonas).toHaveLength(CONFIG.filas * CONFIG.columnas)
    expect(estado.zonas.every((zona) => zona.familias >= CONFIG.familiasMinimas
      && zona.familias <= CONFIG.familiasMaximas)).toBe(true)
    expect(estado.zonas.every((zona) => zona.agua >= CONFIG.aguaInicialMinima
      && zona.agua <= CONFIG.aguaInicialMaxima)).toBe(true)
    expect(estado.totalFamilias).toBe(
      estado.zonas.reduce((total, zona) => total + zona.familias, 0),
    )
  })

  it('debe producir el mismo tablero con la misma semilla', () => {
    expect(crearEstado(42).zonas).toEqual(crearEstado(42).zonas)
  })

  it('debe producir tableros distintos con semillas distintas', () => {
    expect(crearEstado(42).zonas).not.toEqual(crearEstado(43).zonas)
  })
})

describe('la acción de avisar', () => {
  it('debe evacuar una zona en riesgo y gastar una acción', () => {
    const estado = crearEstadoDePrueba()

    expect(avisar(estado, 0)).toBe(true)
    expect(estado.zonas[0].estado).toBe('evacuada')
    expect(estado.familiasSalvas).toBe(1)
    expect(estado.accionesRestantes).toBe(CONFIG.accionesPorTurno - 1)
  })

  it('debe rechazar avisar una zona ya evacuada', () => {
    const estado = crearEstadoDePrueba()
    estado.zonas[0].estado = 'evacuada'

    expect(avisar(estado, 0)).toBe(false)
  })

  it('debe rechazar avisar una zona inundada', () => {
    const estado = crearEstadoDePrueba()
    estado.zonas[0].estado = 'inundada'

    expect(avisar(estado, 0)).toBe(false)
  })

  it('debe rechazar avisar un índice que no corresponde a una zona', () => {
    expect(avisar(crearEstadoDePrueba(), -1)).toBe(false)
  })
})

describe('la acción de drenar', () => {
  it('debe bajar tres unidades en la zona y una en cada vecina ortogonal', () => {
    const estado = crearEstadoDePrueba()
    const indiceCentral = 12
    estado.zonas[indiceCentral].agua = 4
    estado.zonas[indiceCentral - CONFIG.columnas].agua = 4
    estado.zonas[indiceCentral + CONFIG.columnas].agua = 4
    estado.zonas[indiceCentral - 1].agua = 4
    estado.zonas[indiceCentral + 1].agua = 4

    expect(drenar(estado, indiceCentral)).toBe(true)
    expect(estado.zonas[indiceCentral].agua).toBe(1)
    expect(estado.zonas[indiceCentral - CONFIG.columnas].agua).toBe(3)
    expect(estado.zonas[indiceCentral + CONFIG.columnas].agua).toBe(3)
    expect(estado.zonas[indiceCentral - 1].agua).toBe(3)
    expect(estado.zonas[indiceCentral + 1].agua).toBe(3)
    expect(estado.zonas[0].agua).toBe(0)
    expect(estado.accionesRestantes).toBe(CONFIG.accionesPorTurno - 1)
  })

  it('debe rechazar drenar un índice que no corresponde a una zona', () => {
    expect(drenar(crearEstadoDePrueba(), 25)).toBe(false)
  })
})

describe('las acciones disponibles', () => {
  it('debe rechazar avisar y drenar cuando no quedan acciones', () => {
    const estado = crearEstadoDePrueba()
    estado.accionesRestantes = 0

    expect(avisar(estado, 0)).toBe(false)
    expect(drenar(estado, 0)).toBe(false)
    expect(estado.zonas[0].estado).toBe('enRiesgo')
    expect(estado.zonas[0].agua).toBe(0)
  })

  it('debe rechazar acciones cuando la partida ya terminó', () => {
    const estado = crearEstadoDePrueba()
    estado.resultado = 'ganada'

    expect(avisar(estado, 0)).toBe(false)
    expect(drenar(estado, 0)).toBe(false)
    expect(terminarTurno(estado)).toBe(false)
  })
})

describe('el cierre del turno', () => {
  it('debe hacer llover, avanzar el turno y recuperar las acciones', () => {
    const estado = crearEstadoDePrueba()

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.turno).toBe(2)
    expect(estado.accionesRestantes).toBe(CONFIG.accionesPorTurno)
    expect(estado.zonas[0].agua).toBe(CONFIG.lluviaZonaNormal)
    expect(estado.zonas[20].agua).toBe(CONFIG.lluviaQuebrada)
  })

  it('debe inundar las zonas que llegan al límite y contar sus familias perdidas', () => {
    const estado = crearEstadoDePrueba()
    const indiceNormal = 0
    const indiceQuebrada = 20

    for (const zona of estado.zonas) zona.estado = 'evacuada'
    estado.zonas[indiceNormal].estado = 'enRiesgo'
    estado.zonas[indiceNormal].agua = CONFIG.aguaParaInundarse - CONFIG.lluviaZonaNormal
    estado.zonas[indiceQuebrada].estado = 'enRiesgo'
    estado.zonas[indiceQuebrada].agua = CONFIG.aguaParaInundarse - CONFIG.lluviaQuebrada
    estado.familiasSalvas = 23

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.zonas[indiceNormal].estado).toBe('inundada')
    expect(estado.zonas[indiceQuebrada].estado).toBe('inundada')
    expect(estado.familiasPerdidas).toBe(2)
  })
})

describe('el resultado de la partida', () => {
  it('debe ganar al salvar al menos el 70 por ciento de las familias', () => {
    const estado = crearEstadoDePrueba()

    for (let indice = 0; indice < 17; indice += 1) {
      estado.zonas[indice].estado = 'evacuada'
    }
    estado.familiasSalvas = 17

    expect(obtenerPorcentajeMeta(estado)).toBeLessThan(CONFIG.porcentajeMeta)
    expect(avisar(estado, 17)).toBe(true)
    expect(obtenerPorcentajeMeta(estado)).toBeGreaterThanOrEqual(CONFIG.porcentajeMeta)
    expect(estado.resultado).toBe('ganada')
  })

  it('debe perder cuando ya no es posible alcanzar la meta', () => {
    const estado = crearEstadoDePrueba()
    estado.zonas.forEach((zona) => {
      zona.agua = CONFIG.aguaParaInundarse - CONFIG.lluviaZonaNormal
    })

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.resultado).toBe('perdida')
    expect(obtenerFamiliasEnRiesgo(estado)).toBe(0)
  })
})

describe('la conservación de las familias', () => {
  it('debe mantener constante el total de familias durante las acciones y la lluvia', () => {
    const estado = crearEstadoDePrueba()
    const totalInicial = estado.totalFamilias

    expect(avisar(estado, 0)).toBe(true)
    expect(estado.totalFamilias).toBe(totalInicial)
    expect(drenar(estado, 12)).toBe(true)
    expect(estado.totalFamilias).toBe(totalInicial)
    expect(terminarTurno(estado)).toBe(true)
    expect(estado.totalFamilias).toBe(totalInicial)
    expect(estado.totalFamilias).toBe(
      estado.familiasSalvas + estado.familiasPerdidas + obtenerFamiliasEnRiesgo(estado),
    )
  })
})

describe('una partida completa', () => {
  it('debe poder ganarse avisando primero a las zonas con más familias', () => {
    const estado = crearEstado(17)
    const totalInicial = estado.totalFamilias

    while (estado.resultado === 'enCurso') {
      const zonasEnRiesgo = estado.zonas
        .map((zona, indice) => ({ zona, indice }))
        .filter(({ zona }) => zona.estado === 'enRiesgo')
        .sort((a, b) => b.zona.familias - a.zona.familias)

      for (const { indice } of zonasEnRiesgo.slice(0, CONFIG.accionesPorTurno)) {
        if (estado.resultado !== 'enCurso') break
        expect(avisar(estado, indice)).toBe(true)
        expect(estado.totalFamilias).toBe(totalInicial)
      }

      if (estado.resultado === 'enCurso') {
        expect(terminarTurno(estado)).toBe(true)
        expect(estado.totalFamilias).toBe(totalInicial)
      }
    }

    expect(estado.resultado).toBe('ganada')
    expect(estado.familiasSalvas / estado.totalFamilias).toBeGreaterThanOrEqual(
      CONFIG.porcentajeMeta / 100,
    )
  })

  it('debe terminar en derrota si no se hace nada', () => {
    const estado = crearEstado(501)
    const totalInicial = estado.totalFamilias

    while (estado.resultado === 'enCurso') {
      expect(terminarTurno(estado)).toBe(true)
      expect(estado.totalFamilias).toBe(totalInicial)
    }

    expect(estado.resultado).toBe('perdida')
  })
})
