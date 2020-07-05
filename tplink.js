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
    const excpMessage =  excp.message || `Exception occured`
    retunrData.errMessage = excpMessage
    returnData.returnCode = -1   
  } finally {
    return returnData
  }
}

devices.forEach(async (device) => {
  const deviceData = await getDeviceInfo(device)
  if (deviceData.returnCode === 0) {
    const data = deviceData.data
    const payload = {}
    payload.mac = data.sysInfo.mac
    payload.alias = data.sysInfo.alias
    payload.curr = data.emeter.realtime.current
    payload.volt = data.emeter.realtime.voltage
    payload.power = data.emeter.realtime.power
    payload.total = data.emeter.realtime.total

    logger.info({'message': payload})
  }
})

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ 
      filename: '/home/rahul/github/tplink-logs/tplink.log' 
    })
  ]
});

