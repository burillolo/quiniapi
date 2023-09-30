const { buscaResultados } = require('./webscrap-quiniela');
const { yearWeekIndex } = require('./weekYearUtils');
const fs = require('fs');

const OPCIONES_QUINIELA = ['1', 'X', '2'];

const muestraAciertos = async () => {
  const datosJornada = await buscaResultados(); 
  const resultados = datosJornada.partidos;
  const numeroJornada = datosJornada.numeroJornada;
  console.log({numeroJornada, fecha: datosJornada.fechaJornada});
  const [dia, mes, anio] = datosJornada.fechaJornada.split('/');
  const fechaJornada = new Date(anio, mes-1, dia);
  const jornadaSemana = yearWeekIndex(fechaJornada);
  console.log({numeroJornada, fechaJornada, jornadaSemana});
  const storedPath = `./JUGADA_${jornadaSemana}.json`;
  let jugadas = (fs.existsSync(storedPath)) ? require(storedPath).jugada : [];
  if (!jugadas?.length) throw new Error("No se ha encontrado jugada para esta jornada");
  const data = resultados.reduce((acc, e, i) => {
    let listaApuesta = jugadas[i];
    let resultadoRespuesta =  e.resultado;
    let numPartido = i+1;
    let finalizado =  (numPartido<15 && OPCIONES_QUINIELA.includes(resultadoRespuesta)) || (numPartido>=15 && /[0-2M]-[0-2M]/.test(resultadoRespuesta));
    let acertado = finalizado &&  ((numPartido<15 && listaApuesta.includes(resultadoRespuesta)) || (numPartido>=15 && resultadoRespuesta === jugadas[i]));
    let o = {
      partido: e.partido,
      resultado: resultadoRespuesta,
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