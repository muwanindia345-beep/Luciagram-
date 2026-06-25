const router = require('express').Router();
const cloudinary = require('../lib/cloudinary');
// FIX: was `const { auth }` which destructures undefined — auth.js is a default export
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { data, type = 'image', folder = 'luciagram' } = req.body;
    if (!data) return res.status(400).json({ message: 'No file data' });
    const result = await cloudinary.uploader.upload(data, {
      folder: folder,
      resource_type: type === 'video' ? 'video' : 'image',
      transformation: type === 'avatar' ? [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' }
      ] : []
    });
    res.json({ url: result.secure_url, publicId: result.public_id, type: result.resource_type });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
