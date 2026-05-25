const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

class SupaStore {
  // Upload media and return public URL
  static async upload(base64Data, mediaType, userId) {
    try {
      const { v4: uuidv4 } = require("uuid");
      const fileId = uuidv4();
      const ext = mediaType === "video" ? "mp4" : "jpg";
      const fileName = `${userId}/${fileId}.${ext}`;

      // Convert base64 to buffer
      const base64Clean = base64Data.includes(",") 
        ? base64Data.split(",")[1] 
        : base64Data;
      const buffer = Buffer.from(base64Clean, "base64");

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("luciagram-media")
        .upload(fileName, buffer, {
          contentType: mediaType === "video" ? "video/mp4" : "image/jpeg",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("luciagram-media")
        .getPublicUrl(fileName);

      console.log("✅ SupaStore: Uploaded", fileName);
      return { url: urlData.publicUrl, fileName };
    } catch (err) {
      console.error("SupaStore upload error:", err);
      throw err;
    }
  }

  // Delete media by fileName
  static async delete(fileName) {
    try {
      const { error } = await supabase.storage
        .from("luciagram-media")
        .remove([fileName]);
      if (error) throw error;
      console.log("🗑️ SupaStore: Deleted", fileName);
    } catch (err) {
      console.error("SupaStore delete error:", err);
    }
  }

  // Get storage stats
  static async stats() {
    try {
      const { data } = await supabase.storage
        .from("luciagram-media")
        .list();
      return { totalFiles: data?.length || 0, storage: "Supabase" };
    } catch {
      return { totalFiles: 0, storage: "Supabase" };
    }
  }
}

module.exports = SupaStore;
