const router = require("express").Router();
const auth = require("../middleware/auth");

const DEEZER = "https://api.deezer.com";

const dz = async (path) => {
  const r = await fetch(DEEZER + path);
  return r.json();
};

const mapTrack = (t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist?.name || "",
  albumArt: t.album?.cover_medium || t.album?.cover || "",
  previewUrl: t.preview || "",
  duration: t.duration || 30,
});

router.get("/suggested", auth, async (req, res) => {
  try {
    const d = await dz("/chart/0/tracks?limit=20");
    res.json((d.data || []).map(mapTrack));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/search", auth, async (req, res) => {
  try {
    const q = req.query.q || "";
    const d = await dz("/search?q=" + encodeURIComponent(q) + "&limit=20");
    res.json((d.data || []).map(mapTrack));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

const MOODS = {
  happy: "happy upbeat", sad: "sad emotional", romantic: "romantic love",
  party: "party dance", chill: "chill lofi", devotional: "devotional spiritual",
  workout: "workout energy", sleep: "sleep peaceful",
};

router.get("/mood", auth, async (req, res) => {
  try {
    const q = MOODS[req.query.mood] || req.query.mood || "happy";
    const d = await dz("/search?q=" + encodeURIComponent(q) + "&limit=20");
    res.json((d.data || []).map(mapTrack));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/genres", auth, async (req, res) => {
  try {
    const d = await dz("/genre");
    res.json((d.data || []).filter(g => g.id !== 0).map(g => ({
      id: g.id, name: g.name, picture: g.picture_medium || g.picture || "",
    })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/genre/:id", auth, async (req, res) => {
  try {
    const d = await dz("/chart/" + req.params.id + "/tracks?limit=20");
    res.json((d.data || []).map(mapTrack));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
