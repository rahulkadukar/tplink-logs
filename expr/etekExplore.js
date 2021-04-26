const fs = require('fs')
const { exec } = require('child_process')
const etekDevices = JSON.parse(fs.readFileSync(`config/etek.json.private`, `utf-8`))

async function execCommand(inCommand) {
  return new Promise((resolve, reject) => {  
    exec(inCommand, (error, stdout, stderr) => {
      if (error) { resolve({ error: error.message }) }
      if (stderr) { resolve({ error: stderr }) }
      resolve({ data: stdout })
    })
  })
}

async function getEtekStats() {
  try {
    console.log(etekDevices)
    const rawDeviceData = await execCommand("python etekcity.py")
    const deviceData = rawDeviceData.data.split(`\n`)
      .filter(r => r.length !== 0)
      .map(r => r.replace(/\'/g, '"'))

    deviceData.forEach(d => {
      const payload = {}
      const data = d.slice(2,-1).split('", "')
        .map(r => r.split('": "'))
      
      data.forEach(r => {
        switch(r[0]) {
          case 'Active Time':
            payload.ontime = parseInt(r[1]) * 60
            break
          case 'Device Name':
            payload.alias = r[1]
            if (etekDevices[r[1]]) {
              const deviceMeta = etekDevices[r[1]]
              payload.device = deviceMeta.i
              payload.mac = deviceMeta.m
            }
            break
          case 'Energy':
            payload.day = parseFloat(r[1])
            break
          case 'Energy Month':
            payload.month = parseFloat(r[1])
            break
          case 'Power':
            payload.power = parseFloat(r[1])
            break
          case 'Status':
            payload.state = r[1].toLowerCase() === 'on' ? 1 : 0
            break
          case 'Voltage':
            payload.volt = parseFloat(r[1])
            break
          default:
            break
        }
      })

      console.log(data, payload)
    }) 
  } catch (excp) {
    console.log(excp.message)
  } finally {
    console.log('X')
  }
}

getEtekStats().then(() => {})
