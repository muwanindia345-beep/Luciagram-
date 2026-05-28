const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/luciagram")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

const SongField = { id: String, title: String, artist: String, albumArt: String, previewUrl: String, duration: Number };
const UserSchema = new mongoose.Schema({ id: String, username: { type: String, unique: true }, email: { type: String, unique: true }, password: String, fullName: String, bio: String, avatar: String, website: String, isPrivate: Boolean, isVerified: Boolean, savedPosts: [String], followRequests: [{ userId: String, username: String }], publicKey: String, loginHistory: [{ ip: String, device: String, time: Date }], failedLogins: { type: Number, default: 0 }, lockedUntil: Date, song: SongField }, { timestamps: true });

const PostSchema = new mongoose.Schema({ 
  id: String, userId: String, username: String, 
  mediaUrl: String,
  mediaFileName: String,
  mediaType: { type: String, default: "image" }, 
  caption: String, location: String, tags: [String], music: { id: String, title: String, artist: String, albumArt: String, previewUrl: String, duration: Number } 
}, { timestamps: true });
PostSchema.index({ createdAt: -1 });

const StorySchema = new mongoose.Schema({ 
  id: String, userId: String, username: String, 
  mediaUrl: String,
  mediaFileName: String,
  mediaType: { type: String, default: "image" }, 
  expiresAt: Date,
  music: { id: String, title: String, artist: String, albumArt: String, previewUrl: String, duration: Number } 
}, { timestamps: true });

const CommentSchema = new mongoose.Schema({ id: String, postId: String, userId: String, username: String, text: String }, { timestamps: true });
const LikeSchema = new mongoose.Schema({ postId: String, userId: String, username: String }, { timestamps: true });
const FollowSchema = new mongoose.Schema({ followerId: String, followerUsername: String, followingId: String, followingUsername: String }, { timestamps: true });
const MessageSchema = new mongoose.Schema({
  id: String,
  senderId: String,
  senderUsername: String,
  receiverId: String,
  receiverUsername: String,
  text: String,
  mediaUrl: String,
  mediaType: String,
  isRead: Boolean,
  replyTo: {
    id: String,
    text: String,
    senderUsername: String,
    mediaType: String,
  },
  reactions: [{ userId: String, username: String, emoji: String }],
}, { timestamps: true });

MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });

const NotificationSchema = new mongoose.Schema({
  id: String,
  userId: String,
  fromUserId: String,
  fromUsername: String,
  fromAvatar: String,
  type: { type: String, enum: ["like", "comment", "follow", "mention", "message", "group_message", "story_like", "story_view"] },
  postId: String,
  postThumb: String,
  text: String,
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

const GroupSchema = new mongoose.Schema({
  id: String,
  name: String,
  avatar: String,
  createdBy: String,
  createdById: String,
  admins: [String],
  members: [{ id: String, username: String, avatar: String }],
  pendingMembers: [{ id: String, username: String, avatar: String, addedBy: String }],
  requireApproval: { type: Boolean, default: false },
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
  replyTo: {
    id: String,
    text: String,
    senderUsername: String,
    mediaType: String,
  },
  reactions: [{ userId: String, username: String, emoji: String }],
  music: { id: String, title: String, artist: String, albumArt: String, previewUrl: String, duration: Number },
}, { timestamps: true });

const StoryViewSchema = new mongoose.Schema({
  storyId: String,
  userId: String,
  username: String,
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  id: String,
  userId: String,
  username: String,
  avatar: String,
  text: String,
  music: { id: String, title: String, artist: String, albumArt: String, previewUrl: String, duration: Number },
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
  Group: mongoose.model("Group", GroupSchema),
  GroupMessage: mongoose.model("GroupMessage", GroupMessageSchema),
  Note: mongoose.model("Note", NoteSchema),
  StoryView: mongoose.model("StoryView", StoryViewSchema),
};
