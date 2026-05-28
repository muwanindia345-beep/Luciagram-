const { User, Report, Post, Notification } = require("./models");
const { v4: uuidv4 } = require("uuid");

class SuspendBot {
  constructor() {
    this.interval = null;
    this.CHECK_INTERVAL = 30 * 60 * 1000; // every 30 minutes
    this.WARN_THRESHOLD = 3;   // reports before warning
    this.SUSPEND_THRESHOLD = 6; // reports before auto-suspend
    this.SPAM_POST_LIMIT = 10;  // posts in 1 hour = spam
  }

  async run() {
    console.log("🤖 SuspendBot: Running checks...");
    try {
      await this.checkReportThresholds();
      await this.checkSpamPosting();
      console.log("🤖 SuspendBot: Done.");
    } catch (err) {
      console.error("🤖 SuspendBot error:", err.message);
    }
  }

  async checkReportThresholds() {
    // Find all users with pending reports, group by targetUserId
    const pipeline = [
      { $match: { status: "pending" } },
      { $group: { _id: "$targetUserId", count: { $sum: 1 }, username: { $first: "$targetUsername" } } },
    ];
    const grouped = await Report.aggregate(pipeline);

    for (const g of grouped) {
      const user = await User.findOne({ id: g._id });
      if (!user || user.isSuspended) continue;

      if (g.count >= this.SUSPEND_THRESHOLD) {
        // Auto-suspend
        await User.updateOne({ id: g._id }, {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendReason: "Auto-suspended: " + g.count + " reports received",
          suspendedBy: "SuspendBot",
        });
        await this.notify(g._id, "🚫 Your account has been suspended due to multiple reports. If you think this is a mistake, contact support.");
        // Mark reports as actioned
        await Report.updateMany({ targetUserId: g._id, status: "pending" }, { status: "actioned", reviewedBy: "SuspendBot", actionTaken: "auto_suspended" });
        console.log("🤖 SuspendBot: Auto-suspended @" + g.username + " (" + g.count + " reports)");

      } else if (g.count >= this.WARN_THRESHOLD) {
        // Check if already warned recently (in last 24h)
        const recentWarn = user.warnings?.find(w => w.issuedBy === "SuspendBot" && (Date.now() - new Date(w.issuedAt).getTime()) < 24 * 60 * 60 * 1000);
        if (recentWarn) continue;
        await User.updateOne({ id: g._id }, {
          $push: { warnings: { reason: "Suspicious activity: " + g.count + " reports", issuedBy: "SuspendBot", issuedAt: new Date() } }
        });
        await this.notify(g._id, "⚠️ Warning: Your account has received multiple reports for suspicious activity. Please follow community guidelines.");
        console.log("🤖 SuspendBot: Warned @" + g.username + " (" + g.count + " reports)");
      }
    }
  }

  async checkSpamPosting() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pipeline = [
      { $match: { createdAt: { $gte: oneHourAgo } } },
      { $group: { _id: "$userId", count: { $sum: 1 }, username: { $first: "$username" } } },
      { $match: { count: { $gte: this.SPAM_POST_LIMIT } } },
    ];
    const spammers = await Post.aggregate(pipeline);

    for (const s of spammers) {
      const user = await User.findOne({ id: s._id });
      if (!user || user.isSuspended) continue;
      // Issue warning
      const recentWarn = user.warnings?.find(w => w.reason?.includes("spam") && (Date.now() - new Date(w.issuedAt).getTime()) < 2 * 60 * 60 * 1000);
      if (recentWarn) continue;
      await User.updateOne({ id: s._id }, {
        $push: { warnings: { reason: "Spam: " + s.count + " posts in 1 hour", issuedBy: "SuspendBot", issuedAt: new Date() } }
      });
      await this.notify(s._id, "⚠️ Warning: Unusual posting activity detected on your account. Continued spam may lead to suspension.");
      console.log("🤖 SuspendBot: Spam warning to @" + s.username + " (" + s.count + " posts/hr)");
    }
  }

  async notify(userId, text) {
    try {
      await Notification.create({
        id: uuidv4(), userId,
        fromUserId: "system", fromUsername: "Luciagram Safety",
        fromAvatar: "",
        type: "follow",
        text,
        isRead: false,
      });
      if (global.io) global.io.to("user_" + userId).emit("new_notification", { type: "system", text });
    } catch (err) { console.error("SuspendBot notify error:", err.message); }
  }

  start() {
    console.log("🤖 SuspendBot started — checking every 30 minutes");
    this.run(); // run immediately on start
    this.interval = setInterval(() => this.run(), this.CHECK_INTERVAL);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}

module.exports = SuspendBot;
