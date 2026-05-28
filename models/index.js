const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const snk = (k) => k.replace(/([A-Z])/g, "_$1").toLowerCase();
const cam = (k) => k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

const toRow = (doc) => {
  const row = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) row[snk(k)] = v;
  }
  return row;
};

const fromRow = (row) => {
  if (!row) return null;
  const doc = {};
  for (const [k, v] of Object.entries(row)) doc[cam(k)] = v;
  // Add deleteOne instance method
  doc.deleteOne = async () => {
    const table = doc._table;
    if (table) await supabase.from(table).delete().eq("id", doc.id);
  };
  doc.save = async () => {}; // no-op safety
  return doc;
};

const fromRows = (rows, table) => (rows || []).map(r => {
  const d = fromRow(r);
  if (d) d._table = table;
  return d;
});

// Apply MongoDB-style filter to Supabase query
function applyFilter(q, filter) {
  for (const [k, v] of Object.entries(filter)) {
    const col = snk(k);
    if (v === null || v === undefined) {
      q = q.is(col, null);
    } else if (typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      // MongoDB operators
      for (const [op, val] of Object.entries(v)) {
        if (op === "$in")  q = q.in(col, val);
        else if (op === "$nin") q = q.not(col, "in", `(${val.map(x => `"${x}"`).join(",")})`);
        else if (op === "$gt")  q = q.gt(col, val instanceof Date ? val.toISOString() : val);
        else if (op === "$gte") q = q.gte(col, val instanceof Date ? val.toISOString() : val);
        else if (op === "$lt")  q = q.lt(col, val instanceof Date ? val.toISOString() : val);
        else if (op === "$lte") q = q.lte(col, val instanceof Date ? val.toISOString() : val);
        else if (op === "$ne")  q = q.neq(col, val);
        else if (op === "$exists" && val === false) q = q.is(col, null);
        else if (op === "$exists" && val === true)  q = q.not(col, "is", null);
      }
    } else {
      q = q.eq(col, v instanceof Date ? v.toISOString() : v);
    }
  }
  return q;
}

class QueryBuilder {
  constructor(table, filter = {}) {
    this.table = table;
    this.filter = filter;
    this._limit = null;
    this._skip = null;
    this._sort = null;
  }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = n; return this; }
  skip(n) { this._skip = n; return this; }
  select(f) { return this; }
  async exec() {
    let q = supabase.from(this.table).select("*");
    q = applyFilter(q, this.filter);
    if (this._sort) {
      for (const [k, dir] of Object.entries(this._sort)) {
        q = q.order(snk(k), { ascending: dir === 1 });
      }
    }
    if (this._skip != null && this._limit != null) {
      q = q.range(this._skip, this._skip + this._limit - 1);
    } else if (this._limit) {
      q = q.limit(this._limit);
    }
    const { data, error } = await q;
    if (error) throw error;
    return fromRows(data, this.table);
  }
  then(res, rej) { return this.exec().then(res, rej); }
}

function makeModel(table) {
  return {
    find: (filter = {}) => new QueryBuilder(table, filter),

    findOne: async (filter) => {
      let q = supabase.from(table).select("*");
      q = applyFilter(q, filter);
      const { data } = await q.limit(1);
      const row = fromRow(data?.[0]);
      if (row) row._table = table;
      return row;
    },

    findById: async (id) => {
      const { data } = await supabase.from(table).select("*").eq("id", id).limit(1);
      const row = fromRow(data?.[0]);
      if (row) row._table = table;
      return row;
    },

    create: async (doc) => {
      const { data, error } = await supabase.from(table).insert(toRow(doc)).select().single();
      if (error) throw error;
      const row = fromRow(data);
      if (row) row._table = table;
      return row;
    },

    findByIdAndUpdate: async (id, update) => {
      const set = update.$set || update;
      const { data, error } = await supabase.from(table).update(toRow(set)).eq("id", id).select().single();
      if (error) throw error;
      const row = fromRow(data);
      if (row) row._table = table;
      return row;
    },

    findOneAndUpdate: async (filter, update) => {
      const existing = await makeModel(table).findOne(filter);
      if (!existing) return null;
      return makeModel(table).findByIdAndUpdate(existing.id, update);
    },

    findByIdAndDelete: async (id) => {
      const { data } = await supabase.from(table).delete().eq("id", id).select().single();
      return fromRow(data);
    },

    updateOne: async (filter, update) => {
      const existing = await makeModel(table).findOne(filter);
      if (!existing) return null;
      const set = update.$set || update;
      const push = update.$push;
      let finalUpdate = { ...toRow(set) };
      if (push) {
        for (const [k, v] of Object.entries(push)) {
          const col = snk(k);
          const current = existing[k] || [];
          finalUpdate[col] = [...current, v];
        }
      }
      const { data } = await supabase.from(table).update(finalUpdate).eq('id', existing.id).select().single();
      return fromRow(data);
    },

    updateMany: async (filter, update) => {
      const set = update.$set || update;
      let q = supabase.from(table).update(toRow(set));
      q = applyFilter(q, filter);
      await q;
    },

    deleteOne: async (filter) => {
      const doc = await makeModel(table).findOne(filter);
      if (doc) await supabase.from(table).delete().eq("id", doc.id);
    },

    deleteMany: async (filter = {}) => {
      let q = supabase.from(table).delete();
      q = applyFilter(q, filter);
      await q;
    },

    countDocuments: async (filter = {}) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      q = applyFilter(q, filter);
      const { count } = await q;
      return count || 0;
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
  StoryView:    makeModel("story_views"),
  Report:       makeModel("reports"),
};
