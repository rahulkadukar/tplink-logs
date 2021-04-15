const fs = require('fs')
const { sqlQuery } = require('./postgres')

const measureSource = {
  'Bedroom Lamp': 25,
  'Foyer Lamp': 25,
  'Left Lamp': 25,
  'Right Lamp': 25
}

function formatTimeStamp(t) {
  const n = new Date(t)
  return `${n.toISOString().slice(0,13)}:00:00.000Z`
}

async function init() {
  const deviceData = {}

  /* Read all files that have a filename of length 21 */
  const readLogs = fs.readdirSync('./logs/').filter(f => f.length === 21)

  /* From the files create an object with entry for each unique MAC */
  readLogs.forEach(f => {
    const fileData = fs.readFileSync(`./logs/${f}`, `utf-8`).split(`\n`)
    fileData.filter(r => r.length !== 0).forEach(r => {
      const { message, level, timestamp } = JSON.parse(r)
      if (!(deviceData[message.mac])) {
        deviceData[message.mac] = {}
      }

      deviceData[message.mac][timestamp] = {
        alias: message.alias,
        device: message.device,
        state: message.state,
        ontime: message.ontime,
        day: message.day !== undefined ? message.day : -1,
        month: message.month !== undefined ? message.month : -1,
        power: message.power !== undefined ? message.power : -1
      }
    })
  })

  /* List of unique MAC Addresses*/
  const allDevices = Object.keys(deviceData)
  allDevices.forEach(async r => {
    const device = deviceData[r]  // device: all stats for a specific device
    const hourlyData = []
    const sqlInserts = []
    const sortKeys = Object.keys(device).reverse()  // Sorts by timestamp latest first
    let hourKeyBegin = sortKeys[0].slice(11,13)
    let prevKey = sortKeys[0]
    let uptime = 0

    sortKeys.forEach(k => {
      const hourKey = k.slice(11,13)
      const prevData = device[prevKey]

      /* 
        Process records that do not have power usage through emeter 
        this includes most of the simple WiFi power plugs HS-103

        uptime is used to calculate their power usage
      */
      if (prevData.day === -1) {
        if (prevData.ontime > device[k].ontime)
          uptime += prevData.ontime - device[k].ontime
      }

      if (hourKey !== hourKeyBegin) {
        if (measureSource[prevData.alias]) {
          prevData.powerUsage = measureSource[prevData.alias] * (uptime / 3600)
        }

        /* 
          Enter the last entry in an hour for an array where timestamps
          are reversed, this will put the minimum entry in that hour

          03:10
          03:05
          03:00  ------------> This entry is pushed
          02:55

          03:27
          03:13  ------------> This entry is pushed
          02:59
          02:45
        */
        hourlyData.push({
          ...prevData,
          timestamp: prevKey
        })

        uptime = 0
      }

      hourKeyBegin = hourKey
      prevKey = k
    })


    /*
      At this point hourlyData has powerUsage by hour
      [
        { tstmp: '03:XX', data: ... }
        { tstmp: '02:XX', data: ... }
      ]
    */

    let counter = 0
    for (let i = 0; i < hourlyData.length - 1; ++i) {
      const summaryData = {}
      if (hourlyData[i + 1].powerUsage) {
        summaryData.powerUsage = parseInt(hourlyData[i + 1].powerUsage)
      } else {
        if (hourlyData[i].day < hourlyData[i+1].day) {
          summaryData.powerUsage = parseInt((hourlyData[i].month - hourlyData[i+1].month) * 1e3)    
        } else {
          summaryData.powerUsage = parseInt((hourlyData[i].day - hourlyData[i+1].day) * 1e3)
        }
      }

      summaryData.time = formatTimeStamp(hourlyData[i + 1].timestamp)
      summaryData.alias = hourlyData[i].alias
      

      try {
        const timeDiff = Math.abs(new Date(hourlyData[i+1].timestamp).getTime() - 
          new Date(hourlyData[i].timestamp).getTime()) / 1e3
        const variation = [50, 70]
        if (variation[0] * 60 <= timeDiff && timeDiff <= variation[1] * 60) {
          sqlInserts.push(summaryData)
          ++counter
        }
      } catch (e) {
        console.log(`Error in processing record for ${summaryData.alias}`)
      }
    }

    if (sqlInserts.length !== 0) {
      let insertQuery = `INSERT INTO "powerusage"` +
      `("devicename", "timestamp", "watts") VALUES`
      sqlInserts.forEach(r => {
        insertQuery += `('${r.alias}', '${new Date(r.time).toISOString()}', '${r.powerUsage}'),`
      })

      await sqlQuery(`${insertQuery.slice(0,-1)} ON CONFLICT DO NOTHING`)
    }
  })
}

exports.init = init

