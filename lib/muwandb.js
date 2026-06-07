const API_URL = process.env.MUWAN_DB_URL || 'https://muwandb-server.onrender.com'

class MuwanQuery {
  constructor(client, table) {
    this.client = client
    this.table = table
    this._query = ''
  }
  select(cols = '*') { this._query = `SELECT ${cols} FROM ${this.table}`; return this }
  insert(data) { const values = Object.values(data).join(' '); this._query = `INSERT INTO ${this.table} (${values})`; return this }
  delete() { this._query = `DELETE FROM ${this.table}`; return this }
  update(data) { this._query = `UPDATE ${this.table}`; this._updateData = data; return this }
  eq(col, val) { this._query += this._query.toUpperCase().includes('WHERE') ? ` AND ${col} = ${val}` : ` WHERE ${col} = ${val}`; return this }
  gt(col, val) { this._query += this._query.toUpperCase().includes('WHERE') ? ` AND ${col} > ${val}` : ` WHERE ${col} > ${val}`; return this }
  lt(col, val) { this._query += this._query.toUpperCase().includes('WHERE') ? ` AND ${col} < ${val}` : ` WHERE ${col} < ${val}`; return this }
  async run(userId = null) { return this.client._query(this._query, userId) }
}

class MuwanDB {
  constructor(apiKey, dbPassword, isSecret = false) {
    this.apiKey = apiKey
    this.dbPassword = dbPassword
    this.isSecret = isSecret
  }
  from(table) { return new MuwanQuery(this, table) }
  async createTable(name, schema) {
    const fields = Object.entries(schema).map(([col, type]) => `${col}:${type}`).join(' ')
    return this._query(`CREATE TABLE ${name} (${fields})`)
  }
  async dropTable(name) { return this._query(`DROP TABLE ${name}`) }
  async showTables() { return this._query('SHOW TABLES') }
  async rawQuery(query, userId = null) { return this._query(query, userId) }
  async _query(query, userId = null) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (this.isSecret) { headers['x-secret-key'] = this.apiKey }
      else { headers['x-api-key'] = this.apiKey }
      const body = { query, dbPassword: this.dbPassword }
      if (userId) body.userId = userId
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST', headers, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error, data: null }
      return { data: data.result, error: null, appliedQuery: data.appliedQuery }
    } catch (err) {
      return { error: err.message, data: null }
    }
  }
  static createClient(apiKey, dbPassword) {
    const isSecret = apiKey.startsWith('mwn_secret_')
    return new MuwanDB(apiKey, dbPassword, isSecret)
  }
}

module.exports = MuwanDB
module.exports.createClient = MuwanDB.createClient
