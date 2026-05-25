const mongoose = require("mongoose");

// LuciaStore - Smart Media Storage System
const MediaChunkSchema = new mongoose.Schema({
  mediaId: { type: String, required: true, index: true },
  chunkIndex: Number,
  totalChunks: Number,
  data: String,
  mediaType: String,
  uploadedBy: String,
  createdAt: { type: Date, default: Date.now, expires: 60*60*24*365 }
});

const MediaMetaSchema = new mongoose.Schema({
  mediaId: { type: String, required: true, unique: true },
  mediaType: String,
  totalChunks: Number,
  size: Number,
  uploadedBy: String,
  createdAt: { type: Date, default: Date.now }
});

const MediaChunk = mongoose.model("MediaChunk", MediaChunkSchema);
const MediaMeta = mongoose.model("MediaMeta", MediaMetaSchema);

const CHUNK_SIZE = 500000; // 500KB per chunk

class LuciaStore {
  // Store media and return mediaId
  static async store(base64Data, mediaType, userId) {
    try {
      const { v4: uuidv4 } = require("uuid");
      const mediaId = uuidv4();
      const chunks = [];
      
      // Split into chunks
      for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
        chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
      }

      // Save all chunks
      await Promise.all(chunks.map((chunk, index) =>
        MediaChunk.create({
          mediaId,
          chunkIndex: index,
          totalChunks: chunks.length,
          data: chunk,
          mediaType,
          uploadedBy: userId,
        })
      ));

      // Save metadata
      await MediaMeta.create({
        mediaId,
        mediaType,
        totalChunks: chunks.length,
        size: base64Data.length,
        uploadedBy: userId,
      });

      console.log(`✅ LuciaStore: Stored media ${mediaId} in ${chunks.length} chunks`);
      return mediaId;
    } catch (err) {
      console.error("LuciaStore store error:", err);
      throw err;
    }
  }

  // Retrieve media by mediaId
  static async retrieve(mediaId) {
    try {
      const meta = await MediaMeta.findOne({ mediaId });
      if (!meta) return null;

      const chunks = await MediaChunk
        .find({ mediaId })
        .sort({ chunkIndex: 1 })
        .lean();

      if (chunks.length === 0) return null;

      const base64Data = chunks.map(c => c.data).join("");
      return { data: base64Data, mediaType: meta.mediaType };
    } catch (err) {
      console.error("LuciaStore retrieve error:", err);
      return null;
    }
  }

  // Delete media
  static async delete(mediaId) {
    try {
      await MediaChunk.deleteMany({ mediaId });
      await MediaMeta.deleteOne({ mediaId });
      console.log(`🗑️ LuciaStore: Deleted media ${mediaId}`);
    } catch (err) {
      console.error("LuciaStore delete error:", err);
    }
  }

  // Get storage stats
  static async stats() {
    const totalMedia = await MediaMeta.countDocuments();
    const totalChunks = await MediaChunk.countDocuments();
    return { totalMedia, totalChunks };
  }
}

module.exports = { LuciaStore, MediaChunk, MediaMeta };
