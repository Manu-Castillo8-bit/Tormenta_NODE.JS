import './estilo.css'
import {
  CONFIG,
  avisar,
  crearEstado,
  drenar,
  terminarTurno,
  type Estado,
} from './juego'

type VistaPantalla = 'inicio' | 'juego' | 'final'
type TipoAccion = 'avisar' | 'drenar'

const appElement = document.querySelector<HTMLElement>('#app')!

let vista: VistaPantalla = 'inicio'
let accionActiva: TipoAccion = 'avisar'
let estadoActual: Estado = crearEstado(1)

function nuevaPartida(): void {
  const semilla = Date.now() + Math.floor(Math.random() * 1000)
  estadoActual = crearEstado(semilla)
  accionActiva = 'avisar'
  vista = 'juego'
  renderizar()
}

function porcentajeMeta(): number {
  return estadoActual.totalFamilias === 0
    ? 0
    : (estadoActual.familiasSalvas / estadoActual.totalFamilias) * 100
}

function obtenerClaseZona(zona: Estado['zonas'][number]): string {
  if (zona.estado === 'inundada') return 'zona zona--inundada'
  if (zona.estado === 'evacuada') return 'zona zona--evacuada'
  if (zona.agua >= CONFIG.aguaParaInundarse - 1) return 'zona zona--peligro'
  if (zona.agua >= 3) return 'zona zona--riesgo'
  return 'zona zona--tranquila'
}

function renderizar(): void {
  const meta = Math.ceil((estadoActual.totalFamilias * CONFIG.porcentajeMeta) / 100)
  const textoResultado = estadoActual.resultado === 'ganada'
    ? '¡Logramos salvar a la comunidad!'
    : estadoActual.resultado === 'perdida'
      ? 'Se agotó el tiempo y la tormenta ganó.'
      : 'La comunidad sigue a la espera.'

  if (vista === 'inicio') {
    appElement.innerHTML = `
      <main class="pantalla pantalla--inicio">
        <section class="panel panel--inicio">
          <p class="eyebrow">Tormenta · el turno de la comunidad</p>
          <h1>Tormenta</h1>
          <p class="descripcion">
            Coordinás a la comunidad mientras sube el agua: decidís a quién avisar y dónde abrir drenaje.
          </p>
          <p class="meta">Objetivo: salvar al menos el 70% de las familias en 8 turnos.</p>
          <button type="button" class="boton boton--primario" id="iniciar-partida">
            Comenzar partida
          </button>
        </section>
      </main>
    `

    const botonIniciar = appElement.querySelector<HTMLButtonElement>('#iniciar-partida')
    botonIniciar?.addEventListener('pointerdown', (evento) => {
      evento.preventDefault()
      nuevaPartida()
    })
    return
  }

  if (vista === 'final') {
    appElement.innerHTML = `
      <main class="pantalla pantalla--final">
        <section class="panel">
          <p class="eyebrow">Resultado</p>
          <h2>${estadoActual.resultado === 'ganada' ? 'Victoria' : 'Derrota'}</h2>
          <p>${textoResultado}</p>
          <ul class="resumen">
            <li>Familias salvadas: ${estadoActual.familiasSalvas}</li>
            <li>Familias perdidas: ${estadoActual.familiasPerdidas}</li>
            <li>Meta: ${meta}</li>
            <li>Porcentaje: ${porcentajeMeta().toFixed(1)}%</li>
          </ul>
          <button type="button" class="boton boton--primario" id="reiniciar-partida">
            Jugar otra vez
          </button>
        </section>
      </main>
    `

    const botonReiniciar = appElement.querySelector<HTMLButtonElement>('#reiniciar-partida')
    botonReiniciar?.addEventListener('pointerdown', (evento) => {
      evento.preventDefault()
      nuevaPartida()
    })
    return
  }

  appElement.innerHTML = `
    <main class="pantalla pantalla--juego">
      <header class="cabecera">
        <div>
          <p class="eyebrow">Turno ${estadoActual.turno} de ${CONFIG.turnosMaximos}</p>
          <h1>Tormenta</h1>
        </div>
        <div class="acciones-turno">
          <button type="button" class="boton ${accionActiva === 'avisar' ? 'boton--activo' : ''}" data-accion="avisar">
            Avisar
          </button>
          <button type="button" class="boton ${accionActiva === 'drenar' ? 'boton--activo' : ''}" data-accion="drenar">
            Drenar
          </button>
          <button type="button" class="boton boton--primario" id="finalizar-turno">
            Finalizar turno
          </button>
        </div>
      </header>

      <section class="estadisticas">
        <article class="tarjeta">
          <span>Acciones</span>
          <strong>${estadoActual.accionesRestantes}</strong>
        </article>
        <article class="tarjeta">
          <span>Salvadas</span>
          <strong>${estadoActual.familiasSalvas}</strong>
        </article>
        <article class="tarjeta">
          <span>En riesgo</span>
          <strong>${estadoActual.zonas.filter((zona) => zona.estado === 'enRiesgo').length}</strong>
        </article>
        <article class="tarjeta">
          <span>Pérdidas</span>
          <strong>${estadoActual.familiasPerdidas}</strong>
        </article>
        <article class="tarjeta">
          <span>Meta</span>
          <strong>${porcentajeMeta().toFixed(1)}%</strong>
        </article>
      </section>

      <section class="panel">
        <div class="grilla" aria-label="Tablero del juego">
          ${estadoActual.zonas
            .map((zona, indice) => {
              const clase = obtenerClaseZona(zona)
              return `
                <button
                  type="button"
                  class="${clase}"
                  data-indice="${indice}"
                  aria-label="Zona ${indice + 1}: ${zona.familias} familias, ${zona.agua} de agua, estado ${zona.estado}"
                  title="Familias: ${zona.familias} · Agua: ${zona.agua} · Estado: ${zona.estado}"
                >
                  <span class="familias">${zona.familias}</span>
                  <span class="agua">${zona.agua}</span>
                  <span class="leyenda">familias</span>
                  <span class="leyenda">agua</span>
                </button>
              `
            })
            .join('')}
        </div>
      </section>
    </main>
  `

  const botonesAccion = appElement.querySelectorAll<HTMLButtonElement>('[data-accion]')
  botonesAccion.forEach((boton) => {
    boton.addEventListener('pointerdown', (evento) => {
      evento.preventDefault()
      const accion = boton.dataset.accion as TipoAccion | undefined
      if (accion === 'avisar' || accion === 'drenar') {
        accionActiva = accion
        renderizar()
      }
    })
  })

  const botonesZona = appElement.querySelectorAll<HTMLButtonElement>('.zona')
  botonesZona.forEach((boton) => {
    boton.addEventListener('pointerdown', (evento) => {
      evento.preventDefault()
      const indice = Number.parseInt(boton.dataset.indice ?? '', 10)
      if (Number.isNaN(indice)) {
        return
      }

      if (accionActiva === 'avisar') {
        avisar(estadoActual, indice)
      } else {
        drenar(estadoActual, indice)
      }

      if (estadoActual.resultado !== 'enCurso') {
        vista = 'final'
      }

      renderizar()
    })
  })

  const finalizar = appElement.querySelector<HTMLButtonElement>('#finalizar-turno')
  finalizar?.addEventListener('pointerdown', (evento) => {
    evento.preventDefault()
    terminarTurno(estadoActual)
    if (estadoActual.resultado !== 'enCurso') {
      vista = 'final'
    }
    renderizar()
  })
}

renderizar()
