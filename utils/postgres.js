const { Pool } = require('pg')
const { dbConnection } = require('../config/postgres.js.private')
const NodeCache = require( "node-cache" )
const level0 = new NodeCache({ stdTTL: 12 * 60 * 60 })

const pgsql = new Pool({
  user: dbConnection.user,
  host: dbConnection.host,
  database: dbConnection.database,
  password: dbConnection.password,
  port: dbConnection.port
})

async function sqlQuery(query) {
  const dbData = { returnCode: 0, errMessage: ''}

  try {
    const result = await pgsql.query(query)
    dbData.dbResult = JSON.parse(JSON.stringify(result)).rows
  } catch (excp) {
    dbData.returnCode = -1
    dbData.errMessage = excp.message ? excp.message : `ERROR IN: [${query}]`
  } finally {
    // Do nothing
  }

  return dbData
}

exports.sqlQuery = sqlQuery
exports.level0 = level0