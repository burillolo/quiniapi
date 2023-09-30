const puppeteer = require('puppeteer');
const jsdom = require('jsdom');

const buscaJornada = async () => {
    const data = {};
    try {
      // Abrimos una instancia del puppeteer y accedemos a la url
      const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']}) ;
      const page = await browser.newPage();
      const response = await page.goto("https://juegos.loteriasyapuestas.es/jugar/la-quiniela/apuesta/");
      const body = await response.text();
  
      // Creamos una instancia del resultado devuelto por puppeter para parsearlo con jsdom
      const { window: { document } } = new jsdom.JSDOM(body);
  
      if (!document.querySelectorAll(".nombre-partido-completo")?.length) {
        let error = "Pagina en mantenimiento";
        console.log(error);
        throw new Error(error);
      }
      let numeroJornada = document.querySelector(".numero-jornadas").textContent.trim().match(/\d+/)[0];
      console.log(`Obteniendo jornada: ${numeroJornada}`);
      let inicioJornadaDia = document.querySelector(".datos-sorteos-dia").textContent.trim();
      let horaJornada = document.querySelector(".datos-sorteos-hora").textContent.trim();
      
      let partidos = [];
      // Seleccionamos los títulos y lo mostramos en consola
      document.querySelectorAll(".nombre-partido-completo")
        .forEach(element => {
          var nombrePartido = element.textContent.trim();
          var equipos = nombrePartido.replaceAll('\t','').replaceAll('\n', '').split(/\s+-\s+/);
          console.log(`${equipos[0]} - ${equipos[1]}`);
          partidos.push({local: equipos[0], visitante: equipos[1]});
        });
      // Cerramos el puppeteer
      await browser.close();
  
      let dateTokens = /(\d{2})\/(\d{2})\/(\d{4})/.exec(inicioJornadaDia);
      let hourTokens = /.*(\d{2})\s*:\s*(\d{2})/.exec(horaJornada);
      let timezoneOffset = Math.abs(new Date().getTimezoneOffset()) / 60;
      const fechaStr = `${dateTokens[3]}-${dateTokens[2]}-${dateTokens[1]}T${hourTokens[1]}:${hourTokens[2]}:00+0${timezoneOffset}00`;
      const launchDate = new Date(fechaStr);
      console.log(`Fecha jornada: ${launchDate}`);
  
      data['partidos'] = partidos;
      data['inicio'] = launchDate;
      data ['numero'] = numeroJornada;
      data['fecha'] = fechaStr;
    } catch (error) {
      console.error(error);
      throw error;
    }
    return data;
  }

const buscaResultados = async ()  => {
    let resultData = [];
    try {
      // Abrimos una instancia del puppeteer y accedemos a la url
      const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']}/*{headless: false}*/);
      const page = await browser.newPage();
      console.log("Obteniendo resultados...");
      
      resultData = await openPage({page});
      await browser.close();
    } catch (error) {
      console.error(error);
    }
    return new Promise((res) => res(resultData));
}

async function openPage ({ page }) {

  const response = await page.goto('https://www.loteriasyapuestas.es/es/resultados/quiniela', {timeout: 60000, waitUntil: 'domcontentloaded'});
  //const body = await response.text();

  // Creamos una instancia del resultado devuelto por puppeter para parsearlo con jsdom
  //const { window: { document } } = new jsdom.JSDOM(body);

  // Here, we inject some JavaScript into the page to build a list of results
  const resultsElemEval = () => {
    const fechaJornada = document.getElementById("qa_resultadoSorteo-fecha-LAQU-0").textContent;
    const numeroJornada = document.querySelector("div[id='qa_resultadoSorteo-masInfo-LAQU-0'] p span.c-resultado-sorteo__fecha-jornada").textContent.trim().match(/\d+/)[0];
    const elements = 
    [...Array(15).keys()].map(i => {
      let keySigno = `qa_ultResult-signoGanador-LAQU-0${i}`;
      let keyPartido = `qa_resultadoSorteo-partido-LAQU-0${i}`;
      let o = {
        resultado: document.getElementById(keySigno),
        partido: document.getElementById(keyPartido)
      }
      return o;
    }).map((elemsObj) => {
        let textObj = {};
        debugger;
        Object.keys(elemsObj).forEach(function(key, index) {
            textObj[key] = elemsObj[key].textContent.replace(/\s/g, '');
          });
          return textObj;
    });
    console.log(elements);
    return {partidos: elements, fechaJornada, numeroJornada};
  };
  const readyHandler = await page.waitForSelector('.c-resultados-buscador__quiniela')

  const items = await readyHandler.evaluate(resultsElemEval);
  return items;
};

exports.buscaJornada = buscaJornada;
exports.buscaResultados = buscaResultados;