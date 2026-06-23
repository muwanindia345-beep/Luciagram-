require("dotenv").config();
const MuwanDB = require("../lib/muwandb");

const db = MuwanDB.createClient(
  process.env.MUWAN_API_KEY,
  process.env.MUWAN_DB_PASSWORD
);

const snk = (k) => k.replace(/([A-Z])/g, "_$1").toLowerCase();
const cam = (k) => k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

const toRow = (doc) => {
  const row = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) {
      row[snk(k)] = (Array.isArray(v) || (v && typeof v === "object" && !(v instanceof Date)))
        ? JSON.stringify(v)
        : v;
    }
  }
  return row;
};

const fromRow = (row) => {
  if (!row) return null;
  const doc = {};
  for (const [k, v] of Object.entries(row)) doc[cam(k)] = v;
  doc.save = async () => {};
  return doc;
};

const fromRows = (rows) => (rows || []).map(r => fromRow(r));

function escVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function runQuery(query) {
  const { data, error } = await db.rawQuery(query);
  if (error) throw new Error(error);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try { const p = JSON.parse(data); return Array.isArray(p) ? p : [p]; }
    catch { return []; }
  }
  if (typeof data === "object") return [data];
  return [];
}

function buildWhere(filter, notInMap) {
  if (!filter || Object.keys(filter).length === 0) return "";
  const parts = [];
  for (const [k, v] of Object.entries(filter)) {
    if (k === "$or" && Array.isArray(v)) {
      const orParts = v.map(cond => {
        const [field, val] = Object.entries(cond)[0];
        const col = snk(field);
        if (typeof val === "object" && val.$regex) {
          return col + " LIKE '%" + String(val.$regex).replace(/[.*+?^${}()|[\]\\]/g, "") + "%'";
        }
        return col + " = " + escVal(val);
      });
      parts.push("(" + orParts.join(" OR ") + ")");
      continue;
    }
    const col = snk(k);
    if (v === null || v === undefined) {
      parts.push(col + " IS NULL");
    } else if (typeof v === "object" && !Array.isArray(v)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === "$in") {
          if (!val || val.length === 0) { parts.push("1=0"); continue; }
          const nonNull = val.filter(x => x !== null && x !== undefined);
          const hasNull = nonNull.length !== val.length;
          const orParts = [];
          if (nonNull.length > 0) orParts.push(col + " IN (" + nonNull.map(x => "'" + String(x) + "'").join("|") + ")");
          if (hasNull) orParts.push(col + " IS NULL");
          parts.push("(" + orParts.join(" OR ") + ")");
        }
        else if (op === "$nin") {
          // Engine mein NOT IN nahi hai — JS side filter
          if (val && val.length > 0 && notInMap) notInMap[col] = val.map(String);
        }
        else if (op === "$gt")     parts.push(col + " > " + escVal(val));
        else if (op === "$gte")    parts.push(col + " >= " + escVal(val));
        else if (op === "$lt")     parts.push(col + " < " + escVal(val));
        else if (op === "$lte")    parts.push(col + " <= " + escVal(val));
        else if (op === "$ne")     parts.push(col + " != " + escVal(val));
        else if (op === "$regex")  parts.push(col + " LIKE '%" + String(val).replace(/[.*+?^${}()|[\]\\]/g, "") + "%'");
        else if (op === "$exists") parts.push(val ? col + " IS NOT NULL" : col + " IS NULL");
      }
    } else {
      parts.push(col + " = " + escVal(v));
    }
  }
  return parts.length ? " WHERE " + parts.join(" AND ") : "";
}

class QueryBuilder {
  constructor(table, filter = {}) {
    this.table = table;
    this.filter = filter;
    this._limit = null;
    this._skip = null;
    this._sort = null;
    this._excludeFields = [];
    this._notIn = {};
  }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = n; return this; }
  skip(n) { this._skip = n; return this; }
  select(f) {
    if (f && typeof f === "string") {
      this._excludeFields = f.split(" ").filter(x => x.startsWith("-")).map(x => x.slice(1));
    }
    return this;
  }
  async exec() {
    let q = "SELECT * FROM " + this.table;
    q += buildWhere(this.filter, this._notIn);
    if (this._sort) {
      const sortParts = Object.entries(this._sort).map(([k, d]) => snk(k) + " " + (d === 1 ? "ASC" : "DESC"));
      q += " ORDER BY " + sortParts.join(", ");
    }
    if (this._skip != null && this._limit != null) {
      q += " LIMIT " + this._limit + " OFFSET " + this._skip;
    } else if (this._limit) {
      q += " LIMIT " + this._limit;
    }
    const rows = await runQuery(q);
    let result = fromRows(Array.isArray(rows) ? rows : [rows]);
    // $nin JS-side filter
    if (Object.keys(this._notIn).length > 0) {
      for (const [col, excluded] of Object.entries(this._notIn)) {
        const jsKey = cam(col);
        result = result.filter(r => {
          const val = r[jsKey] !== undefined ? r[jsKey] : r[col];
          return !excluded.includes(String(val ?? ""));
        });
      }
    }
    if (this._excludeFields.length) {
      return result.map(r => { const obj = {...r}; this._excludeFields.forEach(f => delete obj[f]); return obj; });
    }
    return result;
  }
  then(res, rej) { return this.exec().then(res, rej); }
}

function makeModel(table) {
  return {
    find: (filter = {}) => new QueryBuilder(table, filter),

    findOne: async (filter) => {
      let q = "SELECT * FROM " + table;
      q += buildWhere(filter, {});
      q += " LIMIT 1";
      const rows = await runQuery(q);
      const arr = Array.isArray(rows) ? rows : [rows];
      const row = fromRow(arr[0]) || null;
      if (row) {
        row._table = table;
        row.deleteOne = async () => {
          await runQuery("DELETE FROM " + table + " WHERE id = " + escVal(row.id));
        };
        row.save = async () => {
          const { id, deleteOne: _d, save: _s, _table: _t, ...fields } = row;
          const sets = Object.entries(toRow(fields))
            .map(([k, v]) => k + " = " + escVal(v)).join(", ");
          await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(id));
        };
      }
      return row;
    },

    findById: async (id) => {
      const rows = await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(id) + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      const row = fromRow(arr[0]) || null;
      if (row) {
        row._table = table;
        row.deleteOne = async () => {
          await runQuery("DELETE FROM " + table + " WHERE id = " + escVal(row.id));
        };
        row.save = async () => {
          const { id: rid, deleteOne: _d, save: _s, _table: _t, ...fields } = row;
          const sets = Object.entries(toRow(fields))
            .map(([k, v]) => k + " = " + escVal(v)).join(", ");
          await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(rid));
        };
      }
      return row;
    },

    create: async (doc) => {
      const rowData = toRow(doc);
      const cols = Object.keys(rowData).join(" ");
      const vals = Object.values(rowData).map(v => escVal(v)).join(" ");
      await runQuery("INSERT INTO " + table + " (" + cols + ") VALUES (" + vals + ")");
      const id = rowData.id;
      const rows = id
        ? await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(id) + " LIMIT 1")
        : await runQuery("SELECT * FROM " + table + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      const row = fromRow(arr[0]) || null;
      if (row) {
        row._table = table;
        row.deleteOne = async () => {
          await runQuery("DELETE FROM " + table + " WHERE id = " + escVal(row.id));
        };
        row.save = async () => {
          const { id: rid, deleteOne: _d, save: _s, _table: _t, ...fields } = row;
          const sets = Object.entries(toRow(fields))
            .map(([k, v]) => k + " = " + escVal(v)).join(", ");
          await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(rid));
        };
      }
      return row;
    },

    findByIdAndUpdate: async (id, update) => {
      const set = update.$set || update;
      const sets = Object.entries(toRow(set))
        .map(([k, v]) => k + " = " + escVal(v)).join(", ");
      await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(id));
      const rows = await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(id) + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      return fromRow(arr[0]);
    },

    findOneAndUpdate: async (filter, update) => {
      const existing = await makeModel(table).findOne(filter);
      if (!existing) return null;
      const set = update.$set || update;
      const sets = Object.entries(toRow(set))
        .map(([k, v]) => k + " = " + escVal(v)).join(", ");
      await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(existing.id));
      const rows = await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(existing.id) + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      return fromRow(arr[0]);
    },

    findByIdAndDelete: async (id) => {
      const rows = await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(id) + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      const row = fromRow(arr[0]) || null;
      await runQuery("DELETE FROM " + table + " WHERE id = " + escVal(id));
      return row;
    },

    updateOne: async (filter, update) => {
      const existing = await makeModel(table).findOne(filter);
      if (!existing) return null;
      const set = update.$set || update;
      const push = update.$push;
      let fields = { ...toRow(set) };
      if (push) {
        for (const [k, v] of Object.entries(push)) {
          const col = snk(k);
          const current = existing[k] || [];
          fields[col] = JSON.stringify([...current, v]);
        }
      }
      const sets = Object.entries(fields)
        .map(([k, v]) => k + " = " + escVal(v)).join(", ");
      await runQuery("UPDATE " + table + " SET " + sets + " WHERE id = " + escVal(existing.id));
      const rows = await runQuery("SELECT * FROM " + table + " WHERE id = " + escVal(existing.id) + " LIMIT 1");
      const arr = Array.isArray(rows) ? rows : [rows];
      return fromRow(arr[0]);
    },

    updateMany: async (filter, update) => {
      const set = update.$set || update;
      const sets = Object.entries(toRow(set))
        .map(([k, v]) => k + " = " + escVal(v)).join(", ");
      let q = "UPDATE " + table + " SET " + sets;
      q += buildWhere(filter, {});
      await runQuery(q);
    },

    deleteOne: async (filter) => {
      const doc = await makeModel(table).findOne(filter);
      if (doc) await runQuery("DELETE FROM " + table + " WHERE id = " + escVal(doc.id));
    },

    deleteMany: async (filter = {}) => {
      let q = "DELETE FROM " + table;
      q += buildWhere(filter, {});
      await runQuery(q);
    },

    countDocuments: async (filter = {}) => {
      let q = "SELECT COUNT(*) FROM " + table;
      q += buildWhere(filter, {});
      const rows = await runQuery(q);
      const arr = Array.isArray(rows) ? rows : [rows];
      return Number(arr[0]?.count || arr[0]?.["COUNT(*)"] || 0);
    },

    aggregate: async (pipeline) => {
      try {
        const matchStage = pipeline.find(p => p.$match)?.$match || {};
        const groupStage = pipeline.find(p => p.$group)?.$group;
        let q = "SELECT * FROM " + table;
        q += buildWhere(matchStage, {});
        const rows = await runQuery(q);
        const data = Array.isArray(rows) ? rows : [rows];
        if (!groupStage) return fromRows(data);
        const groupField = groupStage._id?.replace("$", "") || "id";
        const col = snk(groupField);
        const groups = {};
        data.forEach(row => {
          const key = row[col] || row[groupField];
          if (!groups[key]) groups[key] = { _id: key, count: 0 };
          groups[key].count++;
        });
        return Object.values(groups);
      } catch(e) { console.error("aggregate error:", e); return []; }
    },
  };
}

module.exports = {
  User:         makeModel("users"),
  Post:         makeModel("posts"),
  Story:        makeModel("stories"),
  Comment:      makeModel("comments"),
  Like:         makeModel("likes"),
  Follow:       makeModel("follows"),
  Message:      makeModel("messages"),
  Notification: makeModel("notifications"),
  Group:        makeModel("groups"),
  GroupMessage: makeModel("group_messages"),
  Note:         makeModel("notes"),
  Media:        makeModel("media"),
  StoryView:    makeModel("story_views"),
  Report:       makeModel("reports"),
};
