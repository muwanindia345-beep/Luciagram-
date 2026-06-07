const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class SupaStore {
  static async upload(base64Data, mediaType, userId) {
    try {
      const extMap = { video: "mp4", audio: "webm", gif: "gif", image: "jpg" };
      const ext = extMap[mediaType] || "jpg";
      const fileId = uuidv4();
      const fileName = `${userId}_${fileId}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      const base64Clean = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;
      fs.writeFileSync(filePath, Buffer.from(base64Clean, "base64"));

      const url = `${process.env.BASE_URL || "http://localhost:5000"}/uploads/${fileName}`;
      console.log("✅ SupaStore: Saved locally", fileName);
      return { url, fileName };
    } catch (err) {
      console.error("SupaStore upload error:", err);
      throw err;
    }
  }

  static async delete(fileName) {
    try {
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      console.log("🗑️ SupaStore: Deleted", fileName);
    } catch (err) {
      console.error("SupaStore delete error:", err);
    }
  }

  static async stats() {
    try {
      const files = fs.readdirSync(UPLOAD_DIR);
      return { totalFiles: files.length, storage: "Local" };
    } catch {
      return { totalFiles: 0, storage: "Local" };
    }
  }
}

module.exports = SupaStore;
