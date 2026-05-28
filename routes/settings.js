const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// GET all settings
router.get("/", auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", req.user.id)
      .single();
    res.json(data?.settings || {});
  } catch { res.json({}); }
});

// POST — save one key
router.post("/", auth, async (req, res) => {
  try {
    const { key, value } = req.body;
    const { data: existing } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", req.user.id)
      .single();

    const current = existing?.settings || {};
    current[key] = value;

    await supabase.from("user_settings").upsert({
      user_id: req.user.id,
      settings: current,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE — remove one key
router.delete("/:key", auth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", req.user.id)
      .single();

    const current = existing?.settings || {};
    delete current[req.params.key];

    await supabase.from("user_settings").upsert({
      user_id: req.user.id,
      settings: current,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
