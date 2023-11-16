const { buscaPartidos } = require('./loterias-api');
const { yearWeekIndex } = require('./weekYearUtils');
const { loadJsonFromFile } = require('./fileStoreManager');
const { getPronosticosJugadores } = require('./cargaQuinielaFirebase');
const moment = require('moment');
const fs = require('fs');

const OPCIONES_QUINIELA = ['1', 'X', '2'];

const muestraAciertos = async (fechaBusqueda) => {
  const fechaJornada = aDiaJornada(fechaBusqueda);
  const datosJornada = await buscaPartidos(fechaJornada).then(resultados => (resultados[0])); 
  const resultados = datosJornada.partidos;
  const numeroJornada = datosJornada.jornada;
  console.log({numeroJornada, fecha: datosJornada.fecha_sorteo});
  //const [dia, mes, anio] = datosJornada.fechaJornada.split('/');
  //const fechaJornada = new Date(anio, mes-1, dia);
  const jornadaSemana = yearWeekIndex(fechaJornada);
  console.log({numeroJornada, fechaJornada, jornadaSemana});
  const storedPath = `./JUGADA_${jornadaSemana}.json`;
  const infoGuardada = await Promise.resolve(fs.existsSync(storedPath)).then(exists => ((exists) ? loadJsonFromFile(storedPath) : {}));
  let jugadas = infoGuardada?.jugada;
  if (!jugadas?.length) throw new Error("No se ha encontrado jugada para esta jornada");
  const data = resultados.reduce((acc, e, i) => {
    let listaApuesta = jugadas[i];
    let resultadoRespuesta =  (e.signo ?? '?').trim();
    let numPartido = i+1;
    let finalizado =  !!resultadoRespuesta;//(numPartido<15 && OPCIONES_QUINIELA.includes(resultadoRespuesta)) || (numPartido>=15 && /[0-2M]-[0-2M]/.test(resultadoRespuesta));
    let acertado = finalizado &&  ((numPartido<15 && listaApuesta.includes(resultadoRespuesta)) || (numPartido>=15 && resultadoRespuesta === jugadas[i]));
    let o = {
      partido: `${e.local} - ${e.visitante}`,
      resultado: resultadoRespuesta ?? e.fecha,
      finalizado,
      jugado: (numPartido<15) ? listaApuesta : jugadas[i]
    };
    if (finalizado) {
      o["acierto"] = acertado;
      acertado && acc.total++;
    }
    acc[numPartido] = o;
    return acc;
  }, {total: 0})
  let {total, ...dataTable} = data;
  console.table(dataTable);
  console.log(`Total aciertos ${total}`);
  return {...data, numeroJornada, fechaJornada};
};

exports.muestraAciertos = muestraAciertos;

const aciertosJugadores = (fechaDesde, fechaHasta) => {
  return getPronosticosJugadores(fechaDesde ?? aDiaJornadaAnterior(), fechaHasta ?? moment(aDiaJornadaAnterior()).endOf('day').toDate())
    .then(jornadasJugadores => (Promise.all(jornadasJugadores.map(j => (compruebaJornadaJugadores(j))))));
}

exports.aciertosJugadores = aciertosJugadores;

async function compruebaJornadaJugadores(jornada) {
  const fechaJornada = aDiaJornada(jornada.fecha);
  const resultados = await buscaPartidos(fechaJornada).then(resultados => (resultados[0].partidos.map(p => (p.signo.trim()))));
  const aciertosJugadores = Object.entries(jornada.quinielas)
          .map(([nombre, apuestas])=> ({nombre, aciertos: apuestas
            .map((a,i) => ((a==((resultados?.length ?? -1 > i) ? resultados[i] : '?')) ? 1 : 0))
            .reduce((acc, a) => acc+a, 0)}));
  return {fechaJornada, aciertosJugadores};
}

function aDiaJornada(date) {
  return buscaDiaJornada(date);
}

function aDiaJornadaAnterior(date) {
  return buscaDiaJornada(date, true);
}

function buscaDiaJornada(date, previo) {
  const momentDay = moment(date).startOf('day');
  return (!previo && momentDay.isoWeekday() == 7) ? momentDay.toDate() : momentDay.day(7 * ((previo) ? -1 : 1)).toDate();
}