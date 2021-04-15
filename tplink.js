const { Client } = require('tplink-smarthome-api')
const chalk = require('chalk')
const cron = require('node-cron')
const { exec } = require("child_process");
const fs = require('fs')
const winston = require('winston')
const { getOsInfo } = require('winston/lib/winston/exception');
const { init } = require('./server/logProcessor');


const devices = JSON.parse(fs.readFileSync(`./config/devices.json.private`, `utf-8`))


const client = new Client({logLevel: 'info'})
const logDir = 'logs'
const processKey = {
  'This month': 'month',
  'Today': 'day'
}


if (!fs.existsSync(logDir)) { fs.mkdirSync(logDir) }

function d() { return new Date().toISOString() }

async function execCommand(inCommand) {
  return new Promise((resolve, reject) => {  
    exec(inCommand, (error, stdout, stderr) => {
      if (error) { resolve({ error: error.message }) }
      if (stderr) { resolve({ error: stderr }) }
      resolve({ data: stdout })
    })
  })
}

async function getDailyStats(deviceAddr, month) {
  const returnData = { errMessage: '', returnCode: 0 }
  const currMonth = month

  try {
    const cmdToExecute = `kasa --host ${deviceAddr} --plug emeter --month ${currMonth}`
    const powerDataRaw = await execCommand(cmdToExecute)
    returnData.data = powerDataRaw.data
      .split(`\n`).slice(3)
      .filter(r => r.split(',').length === 2)
      .map(r => {
        const dayData = r.split(`,`)
        return {
          d: `${currMonth}-${dayData[0].padStart(2, '0')}`,
          p: `${dayData[1]}`
        }
      })
  } catch (e) {
    returnData.errMessage = e.message
    returnData.returnCode = -1
  }

  return returnData
}

async function getDeviceInfo(deviceAddr) {
  const returnData = { errMessage: '', returnCode: 0 }
  try {
    const deviceData = await client.getDevice({ host: deviceAddr })

    /* -- To view the return structure
    Object.keys(deviceData).forEach(r => console.log(r, deviceData[r]))
    */

    const data = await deviceData.getInfo()
    data.supportsEmeter = deviceData.supportsEmeter

    returnData.data = data
  } catch (excp) {
    const excpMessage =  excp.message ? excp.message : `Exception occured`
    returnData.errMessage = excpMessage
    returnData.returnCode = -1   
  } finally {
    return returnData
  }
}

async function getPowerStats(deviceAddr) {
  const returnData = { errMessage: '', returnCode: 0 }
  try {
    const cmdToExecute = `kasa --host ${deviceAddr} --plug emeter`
    const powerDataRaw = await execCommand(cmdToExecute)
    powerDataRaw.data.split(`\n`)
      .filter(r => r.split(`:`).length === 2)
      .forEach(r => {
        const [ k,v ] = r.split(`:`)
        if (processKey[k]) {
          returnData[processKey[k]] = parseFloat(v.split('kWh')[0].trim())
        }
      })
  } catch (e) {
    returnData.errMessage = e.message
    returnData.returnCode = -1
  }

  return returnData
}

/* Logger object, creates a new file for each day */
const loggerFunc = (fileName) => new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ 
      filename: `./logs/${fileName}_${new Date().toISOString().slice(0,10)}.log` 
    })
  ]
})

/** Runs once every hour 
 * 
*/
cron.schedule('2 4 * * * *', async () => {
  await init()
})


/** Runs once every 5 mins to get information from the devices
 *  
*/
cron.schedule('0 */5 * * * *', () => {
  devices.forEach(async (device) => {
    const deviceData = await getDeviceInfo(device)
    let outputStr = `[${chalk.cyan(d())}]`

    if (deviceData.returnCode === 0) {
      const data = deviceData.data
      const payload = {}

      payload.device = device
      payload.mac = data.sysInfo.mac
      payload.alias = data.sysInfo.alias
      payload.state = data.sysInfo.relay_state
      payload.ontime = data.sysInfo.on_time

      if (deviceData.data.supportsEmeter) {
        payload.curr = data.emeter.realtime.current
        payload.volt = data.emeter.realtime.voltage
        payload.power = data.emeter.realtime.power
        const powerStats = await getPowerStats(device)
        if (powerStats.returnCode === 0) {
          payload.day = powerStats.day
          payload.month = powerStats.month
        } else {
          console.log(`[${chalk.red(d())}]: ERR [${chalk.red(device)}]:POWERSTATS`)
        }
      }

      outputStr += `[${chalk.green(device)}] ${chalk.green(payload.alias)}`
      loggerFunc('tplink').info({'message': payload})
    } else {
      outputStr += `[${chalk.red(device)}] ${chalk.red(deviceData.errMessage)}`
    }

    console.log(outputStr)
  })
})

/** Runs once every 9 hours to get historic information
 *  
*/
cron.schedule('42 9 */9 * * *', () => {
  const monthEnd = new Date().toISOString().slice(0,7)
  const dateToday = new Date().toISOString().slice(0,10)

  devices.forEach(async (device) => {
    let monthStart = `2020-03`
    let x = 0
    const deviceData = await getDeviceInfo(device)
    let outputStr = `[${chalk.cyan(d())}]`

    if (deviceData.returnCode === 0 && deviceData.data.supportsEmeter) {
      const data = deviceData.data
      const payload = {}

      payload.device = device
      payload.mac = data.sysInfo.mac
      payload.alias = data.sysInfo.alias

      while(monthEnd >= monthStart) {
        const dailyStats = await getDailyStats(device, monthStart)
        if (dailyStats.returnCode === 0) {
          dailyStats.data.forEach(r => {
            ++x
            payload.date = r.d
            payload.usage = r.p

            if (r.d !== dateToday) 
            loggerFunc('tplink_d').info({'message': payload})
          })
        } else {
          console.log(dailyStats.errMessage)
        }

        const newMonth = (parseInt(monthStart.slice(-2)) + 1).toString().padStart(2, '0')
        if (newMonth === '13') {
          const newYear = parseInt(monthStart.slice(0,4)) + 1
          monthStart = `${newYear}-01`
        } else {
          monthStart = `${monthStart.slice(0,4)}-${newMonth}`
        }
      }
      outputStr += `[${chalk.green(device)}] ${chalk.green(payload.alias)} [${chalk.green(x)}]`
    } else {
      outputStr += `[${chalk.red(device)}] ${chalk.red(deviceData.errMessage)}`
    }

    console.log(outputStr)
  })
})

