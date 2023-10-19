const fs = require('fs');
const buscaResultados = require('./buscaResultados');
const { buscaProximoSorteo, buscaPartidos, buscaPorcentajes } = require('./loterias-api');
const { cargaJonada } = require('./cargaQuinielaFirebase');
const enviaWhatsapp = require('./enviarWhatsapp');
const { yearWeekIndex } = require('./weekYearUtils');
const { escribeDatosFichero, loadJsonFromFile } = require('./fileStoreManager.js')
const express = require('express');

const DIR_INFO_FILES = '.';
const app_info = require(`${DIR_INFO_FILES}/info_app.json`);
const REF_DB_GROUP_ID = app_info.grupo;
const MENSAJES = {
  "jornada": "Partidos de esta jornada:",
  "pronosticos": "Pronosticos de esta jornada:",
  "aciertos": "Aciertos de esta jornada"
}

const app = express();

let waClient;

// Parse JSON bodies for this app. Make sure you put
// `app.use(express.json())` **before** your route handlers!
app.use(express.json());


app.get('/', async (req, res) => {
  res.send("Quini api: \n\
  # info\n\
  # aciertos\n\
  # cargaJornada\n\
  # enviaNotificacion\n\
  # buscaJornada");
});

app.get('/info', async (req, res) => {

  try {
    if (!req.query.fecha) {
      res.send(await getLastFile(DIR_INFO_FILES));
    }
    else {
      const [year, month, day] = req.query.fecha.split('-');
      const parsedDate = new Date(year, month -1, day);
      let storedPath = `${dir}/JUGADA_${yearWeekIndex(parsedDate)}.json`;
      if (!(fs.existsSync(storedPath))) {
        res.status(404);
        res.send("No hay información para enviar, por favor cargue datos");
      }
      res.send(await loadJsonFromFile(storedPath));
    }
  } catch (error) {
    console.log(error);
    res.status(500);
    res.send(`Error en la obtención de informacion.\n${error.message}`);
  }
});

app.get('/aciertos', async function  (req, res) {
  try {
	  let aciertos = await buscaResultados.muestraAciertos();
	  res.send(aciertos);
  }
  catch (error) {
    console.log(error);
    res.status(500);
    res.send(`Error en la obtención de aciertos.\n${error.message}`);
  }
});

app.get('/buscaJornada', async function (req, res) {
  try {
    let partidosJornada = await datosProximaJornada();
	console.log(partidosJornada.datos[0]);
    let datosGuardados = await getLastFile(DIR_INFO_FILES);
    let { partidos, jornada, fecha_sorteo } = partidosJornada.datos[0];
	let cierre = partidosJornada.cierre;
    escribeDatosFichero({...datosGuardados, ...partidosJornada.datos[0], cierre});
    res.send( {...partidosJornada.datos[0], cierre} );
  }
  catch (error) {
    console.log(error);
    res.status(500);
    res.send(`Error en carga de partidos.\n${error.message}`);
  }
});

app.get('/cargaJornada', async function (req, res) {
  try {
    let partidosJornada = await datosProximaJornada();
    console.log({partidosJornada});
    let { partidos, jornada } = partidosJornada.datos[0];
    let { cierre, fecha } = partidosJornada;
    let { numero, jornadaId: refDB } = await cargaJonada({partidos, numero: jornada, fecha, cierre})
                                              .then(cargadas => cargadas.find(jrd => (jrd.grupoId === REF_DB_GROUP_ID)));
    escribeDatosFichero({numero, partidos, refDB, fecha, cierre}, fecha);
    res.send(partidos)
  }
  catch (error) {
    console.log(error);
    res.status(500);
    res.send(`Error en carga de partidos.\n${error.message}`);
  }
});

app.get('/porcentajes', async (req, res) =>  {
  try {
    let jornada = (await getLastFile(DIR_INFO_FILES)).numero;
    console.log(jornada)
    let porcentajes = await buscaPorcentajes(jornada, 2023);
    res.send(porcentajes)
  }
  catch (error) {
    console.log(error);
    res.status(500);
	  res.send(`Error en carga de porcentajes.\n${error.message}`);
  }

});

app.get('/enviaNotificacion/:notificacion', async function  (req, res) {
  let notificacion = req.params.notificacion;
  console.log(`Enviando notificacion ${notificacion}`);
  let storedInfo;
  try {
   storedInfo = await getLastFile(DIR_INFO_FILES);
  }
  catch(error) {
	  console.log(error);
    res.status(404);
    res.send("No hay información para enviar, por favor cargue datos");
	  return;
  }
  let info = ((tipo, storedInfo) => {
    switch (tipo) {
      case 'url':
        return  {appUrl: app_info.url, grupoUrl: REF_DB_GROUP_ID, jornadaUrl: storedInfo.refDB};
      case 'turno':
        const siguiente = (req.query.siguiente ?? 1) - 1;
        const turnos = app_info.turnos;
        return {siguiente, turnos};
      case 'cierre':
        return {cierre: new Date(storedInfo.cierre)};
      default:
        return storedInfo;
    }
  })(notificacion, storedInfo);
  console.log(info);
  let envioParams = {
    tipo: notificacion,
    mensaje: mensajeNotificacion(notificacion, info),
    info: (notificacion == "aciertos") ? (await buscaResultados.muestraAciertos()) : info
  }
  if ((req.query.canal ?? 'whatsapp') === 'whatsapp') {
    try {
      if (!waClient) waClient = await enviaWhatsapp.createClient();
      let ack = await enviaWhatsapp.enviaWhatsapp(waClient, envioParams);
      res.send(ack);
    } catch (error) {
      console.log('Error en notificación', error);
	    res.status(500);
      res.send(error?.message ?? 'Error notificacion');
    } /*finally {
      waClient && waClient.destroy();
    }*/
  } else {
    console.log('Notificación no enviada, canal desconocido');
    res.status(404);
    res.send('Canal de notificación desconocido. Use las siguientes opciones: [whatsapp, email, sms]');
  }
});

app.post('/guardaJugada', async (req, res) => {
  let storedPath = `./JUGADA_${yearWeekIndex()}.json`;
  let jugada = req.body;
  console.dir({jugada});
  try {
    const datosJornadaPronostico =  await ( (fs.existsSync(storedPath)) ? loadJsonFromFile(storedPath) : Promise.resolve({}));
    const datosEscribir = {...datosJornadaPronostico, jugada};
    escribeDatosFichero(datosEscribir);
    res.json(datosEscribir);
  }
  catch (err) {
	  res.send(err);
	}
});

const port = process.env.PORT || 8000;
app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});

async function getLastFile(dir) {
  return new Promise((res, rej) => {
    // Function to get current filenames
    fs.readdir(dir, (err, files) => {
      if (err)
        rej(err);
      else {
        let currentFile = files.filter(file => (file.startsWith('JUGADA_') && file.endsWith('.json'))).sort().reverse()[0];
        
        if (!currentFile) {
          
          rej.send("No hay ficheros de almacenamiento de jornadas.");
        } else {
          res(`${dir}/${currentFile}`);
        }
      }
      })
    }
  ).then(path => loadJsonFromFile(path));
}

async function datosProximaJornada() {
	return fechasProximoSorteo()
		.then(async ([fecha, cierre]) => {
			datos = await buscaPartidos(fecha);
			return {datos, fecha, cierre};
		  });
}

async function fechasProximoSorteo() {
  let proximosSorteos = await buscaProximoSorteo();
  let sorteoFinde = proximosSorteos.filter(s => s.dia_semana === 'domingo');
  return [new Date(sorteoFinde[0].fecha), new Date(sorteoFinde[0].cierre)];
}

const mensajeNotificacion = (tipo, paramsMsg) => {
  switch (tipo) {
    case 'url':
      const { jornadaUrl, grupoUrl, appUrl } = paramsMsg;
      return `${appUrl}/${grupoUrl}/${jornadaUrl}`;
    case 'turno':
      const { siguiente, turnos } = paramsMsg;
      return `Le toca a ${turnos[siguiente]}`;
    case 'cierre':
      return mensajeCierre(paramsMsg.cierre);
    default:
      return MENSAJES[tipo];
  }
};

function mensajeCierre(fechaCierre) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
  hour: "numeric", minute: "numeric" };
  return `Cierre de ventas: ${fechaCierre.toLocaleDateString('es-ES', options)}`;
}
