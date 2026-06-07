const API_URL = process.env.MUWAN_DB_URL || 'https://muwandb-server.onrender.com'

function escVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  // Escape single quotes inside strings
  return `'${String(v).replace(/'/g, "''")}'`
}

class MuwanQuery {
  constructor(client, table) {
    this.client = client
    this.table = table
    this._query = ''
  }

  select(cols = '*') {
    this._query = `SELECT ${cols} FROM ${this.table}`
    return this
  }

  insert(data) {
    const cols = Object.keys(data).join(' ')
    const vals = Object.values(data).map(v => escVal(v)).join(' ')
    this._query = `INSERT INTO ${this.table} (${cols}) VALUES (${vals})`
    return this
  }

  delete() {
    this._query = `DELETE FROM ${this.table}`
    return this
  }

  update(data) {
    const sets = Object.entries(data)
      .map(([k, v]) => `${k}=${escVal(v)}`)
      .join(' ')
    this._query = `UPDATE ${this.table} SET ${sets}`
    return this
  }

  eq(col, val) {
    const cond = `${col} = ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  neq(col, val) {
    const cond = `${col} != ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  gt(col, val) {
    const cond = `${col} > ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  lt(col, val) {
    const cond = `${col} < ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  gte(col, val) {
    const cond = `${col} >= ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  lte(col, val) {
    const cond = `${col} <= ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  like(col, val) {
    const cond = `${col} LIKE ${escVal(val)}`
    this._query += this._query.toUpperCase().includes('WHERE')
      ? ` AND ${cond}` : ` WHERE ${cond}`
    return this
  }

  limit(n) { this._query += ` LIMIT ${n}`; return this }
  offset(n) { this._query += ` OFFSET ${n}`; return this }
  orderBy(col, dir = 'ASC') { this._query += ` ORDER BY ${col} ${dir}`; return this }

  async run(userId = null) {
    return this.client._query(this._query, userId)
  }
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
      if (this.isSecret) headers['x-secret-key'] = this.apiKey
      else headers['x-api-key'] = this.apiKey

      const body = { query, dbPassword: this.dbPassword }
      if (userId) body.userId = userId

      const res = await fetch(`${API_URL}/query/raw`, {
        method: 'POST', headers, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error, data: null }
      return { data: data.data ?? data.result ?? data, error: null }
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
