const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const createClient = async () => {
    const client = new Client({
                    authStrategy: new LocalAuth()
                   });
             

    const launchInit = (cli) =>
        new Promise((res, reject) => {
            
            cli.on('ready', () => {
                res('Client is ready!');
            });

            cli.on('auth_failure', () => {
                console.log('Error de autentificación');
                reject('Init failure');
            });
 
            cli.on('qr', qr => {
                qrcode.generate(qr, {small: true});
            });

            /*cli.on('group_join', (grp_ntf) => {
                grp_ntf.reply("Gracias por incluirme en vuestro grupo, soy un 🤖");             
            });
            
            cli.on('authenticated', (session) => {    
                // Save the session object in json file
                fs.writeFile(WHATSAPP_SESSION_FILE, JSON.stringify(session), (err) => {
                if (err) {
                    console.log(err)
                }
                });
            });*/
                
            cli.initialize().catch((err) => reject(err));
        });
    let cliInit = await launchInit(client);
    console.log(cliInit);
    return client;
}

const enviaWhatsapp = async (client, notificacion) => {
    return new Promise((res, err) => {
      let sendTo =  require('./info_app.json').chat_nofications;
      let mensaje = ((tipo) => {
        switch (tipo) {
        case 'jornada':
          return jornadasToMessage;
        case 'aciertos':
          return resultadosToMessage;
        case 'pronosticos':
          return pronosticosToMessage;
        default:
          return (ntf) => ntf.mensaje;
      }})(notificacion.tipo)(notificacion);
      if (!mensaje) err("No se ha podido crear el mensaje solicitado");
      client.sendMessage(sendTo, mensaje)
        .then(sentMsg => {
            let chat = sentMsg.getChat();
            if (chat) {
              res(`Envio lanzado ${chat.name}:\n ${sentMsg.body}`);
            }
            else {
                console.log("Execution problem: chat not found");
                err("Sending error");
            }
        }, (e) => err(e))
        
    });
}

const jornadasToMessage = (notificacion) => {
  return `${notificacion.mensaje}\n${notificacion.info.partidos.map(p => `${p.local} - ${p.visitante}`).join('\n')}`
}

const pronosticosToMessage = (notificacion) => {
  const zip = (a, b) => a.map((e, i) => [e, b[i]]);
  const notificacionInfo = notificacion.info;
  return `${notificacion.mensaje}\n${zip(notificacionInfo.partidos, notificacionInfo.jugada).map(([e, p]) => `${e.local} - ${e.visitante}: ${p}`).join('\n')}`
}

const resultadosToMessage = (notificacion) => {
    return `${notificacion.mensaje}\n${Object.entries(notificacion.info).filter(([key, value])=>(typeof(key)=='number' || key.toString().match(/\d+/))).map(([k, p]) => `${k}.${p.partido}: ${p.resultado}. Jugado: ${p.jugado} (${(p.finalizado && p.acierto) ? '✅' : (p.finalizado) ? '❌' : '⏳'})`).join('\n')}\nAciertos:${notificacion.info.total}`
  }

exports.createClient = createClient;
exports.enviaWhatsapp = enviaWhatsapp;