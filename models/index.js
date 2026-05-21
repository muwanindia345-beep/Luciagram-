const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/luciagram")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

const UserSchema = new mongoose.Schema({ id: String, username: { type: String, unique: true }, email: { type: String, unique: true }, password: String, fullName: String, bio: String, avatar: String, isPrivate: Boolean, isVerified: Boolean }, { timestamps: true });
const PostSchema = new mongoose.Schema({ id: String, userId: String, username: String, mediaUrl: { type: String, maxlength: 10000000 }, mediaType: String, caption: String, location: String }, { timestamps: true });
const StorySchema = new mongoose.Schema({ id: String, userId: String, username: String, mediaUrl: { type: String, maxlength: 10000000 }, mediaType: String, expiresAt: Date }, { timestamps: true });
const CommentSchema = new mongoose.Schema({ id: String, postId: String, userId: String, username: String, text: String }, { timestamps: true });
const LikeSchema = new mongoose.Schema({ postId: String, userId: String }, { timestamps: true });
const FollowSchema = new mongoose.Schema({ followerId: String, followingId: String }, { timestamps: true });
const MessageSchema = new mongoose.Schema({ id: String, senderId: String, receiverId: String, text: String, isRead: Boolean }, { timestamps: true });

module.exports = {
  User: mongoose.model("User", UserSchema),
  Post: mongoose.model("Post", PostSchema),
  Story: mongoose.model("Story", StorySchema),
  Comment: mongoose.model("Comment", CommentSchema),
  Like: mongoose.model("Like", LikeSchema),
  Follow: mongoose.model("Follow", FollowSchema),
  Message: mongoose.model("Message", MessageSchema),
};
