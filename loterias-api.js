const HEADER_CHROME = {
  "accept": "application/json, text/javascript, */*; q=0.01",
  "accept-language": "es-ES,es;q=0.9,en;q=0.8,ca;q=0.7,en-GB;q=0.6",
  "content-type": "application/json",
  "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"Windows\"",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "Referer": "https://juegos.loteriasyapuestas.es/",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

const LOTERIAS_API_URL = "https://www.loteriasyapuestas.es/servicios";
const QUINIELA_GAME_ID = "LAQU";

exports.buscaPorcentajes = (jornada, temporada) => {
	const url = `${LOTERIAS_API_URL}/estadisticas?jornada=${jornada}&temporada=${temporada}`;
  return fetchData(url);
};

exports.buscaPartidos = (fechaSorteo) => {
  const [mes, dia, anio] = [Number(fechaSorteo.getMonth()+1).toString().padStart(2, '0'),
                            Number(fechaSorteo.getDate()).toString().padStart(2, '0'),
                            fechaSorteo.getFullYear()];
  const url = `${LOTERIAS_API_URL}/fechav3?game_id=${QUINIELA_GAME_ID}&fecha_sorteo=${anio}${mes}${dia}`;
  console.log(url)
  return fetchData(url);
};

exports.buscaProximoSorteo = () => {
  return fetchData(`${LOTERIAS_API_URL}/proximosv3?game_id=${QUINIELA_GAME_ID}&num=2`).then(s => {console.log(s); return s;});
}

function fetchData(url) {
  return fetch(url, {
    "headers": HEADER_CHROME,
    "body": null,
    "method": "GET"
  })
  .then((res)=> res.json())
}