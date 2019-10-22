console.log(process.version);
const { Client } = require('tplink-smarthome-api');
const winston = require('winston');
var z = 0;

const client = new Client();

// Look for devices, log to console
client.startDiscovery().on('device-new', (device) => {
  device.getInfo().then(function(data) {
    let payload = {};
    payload.mac = data.sysInfo.mac;
    payload.curr = data.emeter.realtime.current;
    payload.volt = data.emeter.realtime.voltage;
    payload.power = data.emeter.realtime.power;
    payload.total = data.emeter.realtime.total;

    logger.info({
      'message': payload
    })
    
    if (z++ === 10) {
      z = 0;
      if (Math.random() < 0.1) {
        console.log('Last logged at ' + Date());
      }
    }
  });  
})

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ 
      filename: '/home/pi/code/node/tplink/logs/tplink.log' 
    })
  ]
});

(function(){
  setTimeout(function(){
    process.exit();
  }, 100000);
})();
