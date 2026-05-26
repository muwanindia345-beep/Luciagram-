const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/luciagram")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

const UserSchema = new mongoose.Schema({ id: String, username: { type: String, unique: true }, email: { type: String, unique: true }, password: String, fullName: String, bio: String, avatar: String, website: String, isPrivate: Boolean, isVerified: Boolean }, { timestamps: true });

const PostSchema = new mongoose.Schema({ 
  id: String, userId: String, username: String, 
  mediaUrl: String,
  mediaFileName: String,
  mediaType: { type: String, default: "image" }, 
  caption: String, location: String, tags: [String] 
}, { timestamps: true });
PostSchema.index({ createdAt: -1 });

const StorySchema = new mongoose.Schema({ 
  id: String, userId: String, username: String, 
  mediaUrl: String,
  mediaFileName: String,
  mediaType: { type: String, default: "image" }, 
  expiresAt: Date 
}, { timestamps: true });

const CommentSchema = new mongoose.Schema({ id: String, postId: String, userId: String, username: String, text: String }, { timestamps: true });
const LikeSchema = new mongoose.Schema({ postId: String, userId: String, username: String }, { timestamps: true });
const FollowSchema = new mongoose.Schema({ followerId: String, followerUsername: String, followingId: String, followingUsername: String }, { timestamps: true });
const MessageSchema = new mongoose.Schema({ id: String, senderId: String, senderUsername: String, receiverId: String, receiverUsername: String, text: String, mediaUrl: String, isRead: Boolean }, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
  id: String,
  userId: String,
  fromUserId: String,
  fromUsername: String,
  fromAvatar: String,
  type: { type: String, enum: ["like", "comment", "follow", "mention"] },
  postId: String,
  postThumb: String,
  text: String,
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const GroupSchema = new mongoose.Schema({
  id: String,
  name: String,
  avatar: String,
  createdBy: String,
  createdById: String,
  admins: [String],
  members: [{ id: String, username: String, avatar: String }],
}, { timestamps: true });

const GroupMessageSchema = new mongoose.Schema({
  id: String,
  groupId: String,
  senderId: String,
  senderUsername: String,
  senderAvatar: String,
  text: String,
  mediaUrl: String,
  mediaType: String,
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  id: String,
  userId: String,
  username: String,
  avatar: String,
  text: String,
  expiresAt: Date,
}, { timestamps: true });

module.exports = {
  User: mongoose.model("User", UserSchema),
  Post: mongoose.model("Post", PostSchema),
  Story: mongoose.model("Story", StorySchema),
  Comment: mongoose.model("Comment", CommentSchema),
  Like: mongoose.model("Like", LikeSchema),
  Follow: mongoose.model("Follow", FollowSchema),
  Message: mongoose.model("Message", MessageSchema),
  Notification: mongoose.model("Notification", NotificationSchema),
};
