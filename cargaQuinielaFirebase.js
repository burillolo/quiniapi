const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const app_info = require('./info_app.json');
const SERVICE_ACCOUNT = require(app_info.firebase_credentials);

initializeApp({
  credential: cert(SERVICE_ACCOUNT)
});


const db = getFirestore();

const cargaJonada = async (data) => {

    try {
      const {fecha, cierre, ...dbData} = data;
      dbData ["inicio"] =  Timestamp.fromDate(fecha ?? new Date());
      if (cierre) {
        dbData ["cierre"] =  Timestamp.fromDate(cierre);
	  }
      const res = await db
        .collection('jornadas')
        .add(dbData);
      console.log("Document successfully written! Id:", res.id);
      const guardaResultado = await guardaJornadaDB(db, res.id, data.numero);
      return guardaResultado.map(actualizacion => ({...data, ...actualizacion}));
    }
    catch (error) {
      console.error("Error writing document: ", error);
    }
}

async function guardaJornadaDB(db, idPartidos, numeroJornada) {
  const updatesRef = db.collection('peñas');
  const peniasDocuments = await updatesRef.listDocuments();
  return Promise.all(peniasDocuments.map(async (doc) => {
    var grupoId = doc.id;
    var docCollection =  doc.collection('jornadas');
    var resJornadaAdd = await docCollection.add(
      {quinielas:[], partidos: db.doc(`/jornadas/${idPartidos}`), numero: numeroJornada}
    );
    console.log('grupo:', grupoId, 'jornada quinielas:', resJornadaAdd.id);
    
    // Atomically increment 
    const res = await doc.update({
      toca: FieldValue.increment(1)
    });
    return {grupoId, jornadaId: resJornadaAdd.id};
  }));
}

exports.cargaJonada = cargaJonada;

exports.getPronosticosJugadores = async (fechaIni, fechaFin) => {
  console.log(`Buscando desde ${fechaIni} hasta ${fechaFin}`);
  const updatesRef = db.collection('peñas');
  const peniasDocuments = await updatesRef.listDocuments();
  const jornadasCollections = db.collection('jornadas');
  const pronosticosJugadores = await jornadasCollections
    .where('inicio', '>=', Timestamp.fromDate(fechaIni))
    .where('inicio', '<=', Timestamp.fromDate(fechaFin)).get().then(querySnapshot => {
      let docs = querySnapshot.docs;
      return Promise.all(docs.flatMap((documentSnapshot) => {
        try {
        
          return peniasDocuments.map((doc) => {
            return doc.collection('jornadas').where('partidos', '==', documentSnapshot.ref).get().then(querySnapshot => {
              let docs = querySnapshot.docs;
              return docs.map(docJugadoresSnapshot => {
                const {quinielas, numero} = docJugadoresSnapshot.data();
                const {inicio} = documentSnapshot.data();
                return {quinielas, fecha: inicio.toDate(), numero};
              });
            })
          })
        } catch (err) {
          console.log(err);
          return "ERROR"
        }
    }));
  });
  return pronosticosJugadores.flat();
} 