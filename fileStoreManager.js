const fs = require('fs');
const { yearWeekIndex } = require('./weekYearUtils');

exports.loadJsonFromFile = async (path) => {
    return new Promise((res, rej) => {
        fs.readFile(require.resolve(path), (err, data) => {
            if (err)
              rej(err);
            else
              res(JSON.parse(data));
          });
    });
}

exports.escribeDatosFichero = (datos, fechaDatos) => {
  fs.writeFile(`JUGADA_${yearWeekIndex(fechaDatos)}.json`, JSON.stringify(datos), (err) => {
    if (err) {
      console.log(err);
      throw err;
    }
  });
}