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
  return doc;
};
const fromRows = (rows) => (rows || []).map(fromRow);

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
    for (const [k, v] of Object.entries(this.filter)) {
      if (Array.isArray(v)) q = q.in(snk(k), v);
      else q = q.eq(snk(k), v);
    }
    if (this._sort) {
      for (const [k, dir] of Object.entries(this._sort)) {
        q = q.order(snk(k), { ascending: dir === 1 });
      }
    }
    if (this._skip != null) {
      q = q.range(this._skip, this._skip + (this._limit || 100) - 1);
    } else if (this._limit) {
      q = q.limit(this._limit);
    }
    const { data, error } = await q;
    if (error) throw error;
    return fromRows(data);
  }
  then(res, rej) { return this.exec().then(res, rej); }
}

function makeModel(table) {
  return {
    find: (filter = {}) => new QueryBuilder(table, filter),

    findOne: async (filter) => {
      let q = supabase.from(table).select("*");
      for (const [k, v] of Object.entries(filter)) {
        if (Array.isArray(v)) q = q.in(snk(k), v);
        else q = q.eq(snk(k), v);
      }
      const { data } = await q.limit(1);
      return fromRow(data?.[0]);
    },

    findById: async (id) => {
      const { data } = await supabase.from(table).select("*").eq("id", id).limit(1);
      return fromRow(data?.[0]);
    },

    create: async (doc) => {
      const { data, error } = await supabase.from(table).insert(toRow(doc)).select().single();
      if (error) throw error;
      return fromRow(data);
    },

    findByIdAndUpdate: async (id, update) => {
      const set = update.$set || update;
      const { data, error } = await supabase.from(table).update(toRow(set)).eq("id", id).select().single();
      if (error) throw error;
      return fromRow(data);
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

    deleteOne: async (filter) => {
      const doc = await makeModel(table).findOne(filter);
      if (doc) await supabase.from(table).delete().eq("id", doc.id);
    },

    deleteMany: async (filter = {}) => {
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(filter)) q = q.eq(snk(k), v);
      await q;
    },

    countDocuments: async (filter = {}) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      for (const [k, v] of Object.entries(filter)) q = q.eq(snk(k), v);
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
