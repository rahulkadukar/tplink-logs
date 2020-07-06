const { Client } = require('tplink-smarthome-api')
const winston = require('winston')
const devices = require('./config/devices.private.json')
var z = 0

const client = new Client({logLevel: 'info'})

async function getDeviceInfo(deviceAddr) {
  const returnData = { errMessage: '', returnCode: 0 }
  try {
    const deviceData = await client.getDevice({ host: deviceAddr })
    const data = await deviceData.getInfo()
    returnData.data = data
  } catch (excp) {
    const excpMessage =  excp.message ? excp.message : `Exception occured`
    returnData.errMessage = excpMessage
    returnData.returnCode = -1   
  } finally {
    return returnData
  }
}

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ 
      filename: `./logs/tplink_${new Date().toISOString().slice(0,10)}.log` 
    })
  ]
});

devices.forEach(async (device) => {
  const deviceData = await getDeviceInfo(device)
  if (deviceData.returnCode === 0) {
    const data = deviceData.data
    const payload = {}
    payload.mac = data.sysInfo.mac
    payload.alias = data.sysInfo.alias
    payload.state = data.sysInfo.relay_state
    payload.ontime = data.sysInfo.on_time

    if (data.sysInfo.model.slice(0,5) === 'HS110') {
      payload.curr = data.emeter.realtime.current
      payload.volt = data.emeter.realtime.voltage
      payload.power = data.emeter.realtime.power
      payload.total = data.emeter.realtime.total
    }

    logger.info({'message': payload})
  }
})

