module.exports.config = {
 name: "kick",
 version: "2.0.0",
 hasPermssion: 1,
 credits: "MINHTRI | TU LUYỆN THÍ",
 description: "XDER | DD IT - Enhancedoá người khỏi nhóm (tag/reply/uid/tên/all)",
 commandCategory: "Nhóm",
 usages: "[tag/reply/uid/tên/all]",
 cooldowns: 2
};

// ==================== CẤU HÌNH ====================
const CONFIG = {
 KICK_DELAY: 300, // Delay giữa mỗi lần kick (ms)
 KICK_ALL_DELAY: 400, // Delay khi kick all
 MAX_KICK_PER_CMD: 10, // Giới hạn số người kick 1 lần
 REQUIRE_CONFIRM_ALL: true, // Yêu cầu xác nhận khi kick all
 SHOW_SUCCESS_MSG: true, // Hiển thị thông báo thành công
 ALLOW_KICK_BY_UID: true // Cho phép kick bằng UID
};

// ==================== MESSAGES ====================
const MSG = {
 NOT_ADMIN: "❌ TU LUYỆN CỦA THÍ CHỦ KHÔNG ĐỦ QUYỀN!",
 BOT_NOT_ADMIN: "❌ Tiểu đệ không đủ quyền để loại bỏ người trong pháp môn!",
 KICK_BOT: "❌ Sư Huynh à, đệ có làm gì sai xin hãy nhẹ tay đừng đuổi đệ đi được không😣",
 KICK_SELF: "❌ Sư Huynh còn cả pháp môn ở đây không thể đi được !",
 KICK_ADMIN: "❌KHÔNG ĐƯỢC PHÉP KICK ĐỒNG MÔN!",
 USER_NOT_FOUND: "❌ Không tìm thấy người dùng!",
 INVALID_USAGE: "⚠️ Cách dùng:\n• Tag người cần kick\n• Reply tin nhắn người cần kick\n• Gõ tên hoặc UID\n• Dùng 'kick all' để kick tất cả",
 KICK_SUCCESS: "✅ Đã đuổi tiểu đệ {name} khỏi pháp môn!",
 KICK_ALL_START: "🔄 Đang kick {count} TU LUYỆN DỞM...",
 KICK_ALL_DONE: "✅ Đã kick xong {success}/{total} TU LUYỆN DỞM!",
 KICK_ERROR: "❌ Lỗi khi kick {name}!",
 MAX_LIMIT: "⚠️ Chỉ có thể kick tối đa {max} người/lần!"
};

// ==================== HELPER FUNCTIONS ====================
class KickHelper {
 constructor(api, event, threadInfo) {
 this.api = api;
 this.event = event;
 this.threadInfo = threadInfo;
 this.threadID = event.threadID;
 this.senderID = event.senderID;
 this.botID = api.getCurrentUserID();
 this.adminIDs = threadInfo.adminIDs.map(i => i.id);
 }

 // Kiểm tra quyền
 checkPermissions() {
 if (!this.adminIDs.includes(this.senderID)) {
 return { ok: false, msg: MSG.NOT_ADMIN };
 }
 if (!this.adminIDs.includes(this.botID)) {
 return { ok: false, msg: MSG.BOT_NOT_ADMIN };
 }
 return { ok: true };
 }

 // Kiểm tra có thể kick user không
 canKick(uid) {
 if (uid == this.botID) return { ok: false, msg: MSG.KICK_BOT };
 if (uid == this.senderID) return { ok: false, msg: MSG.KICK_SELF };
 if (this.adminIDs.includes(uid)) return { ok: false, msg: MSG.KICK_ADMIN };
 return { ok: true };
 }

 // Lấy tên user
 getUserName(uid) {
 const user = this.threadInfo.userInfo.find(u => u.id == uid);
 return user ? user.name : "Người dùng";
 }

 // Chuẩn hóa tên để so sánh
 normalizeName(name) {
 return name
 .toLowerCase()
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g, "")
 .replace(/đ/g, "d")
 .trim();
 }

 // Tìm user theo tên
 findUserByName(nameInput) {
 const normalized = this.normalizeName(nameInput);
 
 // Tìm khớp chính xác
 let user = this.threadInfo.userInfo.find(u => 
 u.name && this.normalizeName(u.name) === normalized
 );
 
 // Tìm khớp một phần
 if (!user) {
 user = this.threadInfo.userInfo.find(u => 
 u.name && this.normalizeName(u.name).includes(normalized)
 );
 }
 
 return user || null;
 }

 // Tìm user theo UID
 findUserByUID(uid) {
 return this.threadInfo.userInfo.find(u => u.id == uid) || null;
 }

 // Kick user
 async kickUser(uid) {
 try {
 await this.api.removeUserFromGroup(uid, this.threadID);
 return { success: true };
 } catch (e) {
 console.log("Kick error:", e);
 return { success: false, error: e };
 }
 }

 // Gửi tin nhắn
 async send(msg) {
 return this.api.sendMessage(msg, this.threadID, this.event.messageID);
 }
}

// ==================== XỬ LÝ KICK ====================
async function handleKickByMentions(helper, mentions) {
 const uids = Object.keys(mentions);
 
 if (uids.length > CONFIG.MAX_KICK_PER_CMD) {
 return helper.send(MSG.MAX_LIMIT.replace("{max}", CONFIG.MAX_KICK_PER_CMD));
 }

 let kicked = [];
 for (const uid of uids) {
 const check = helper.canKick(uid);
 if (!check.ok) {
 await helper.send(check.msg);
 continue;
 }

 const result = await helper.kickUser(uid);
 if (result.success) {
 kicked.push(helper.getUserName(uid));
 }
 await new Promise(r => setTimeout(r, CONFIG.KICK_DELAY));
 }

 if (CONFIG.SHOW_SUCCESS_MSG && kicked.length > 0) {
 await helper.send(`✅ Đã kick tiểu đệ: ${kicked.join(", ")}`);
 }
}

async function handleKickByReply(helper) {
 const uid = helper.event.messageReply.senderID;
 const check = helper.canKick(uid);
 
 if (!check.ok) {
 return helper.send(check.msg);
 }

 const result = await helper.kickUser(uid);
 if (result.success && CONFIG.SHOW_SUCCESS_MSG) {
 const name = helper.getUserName(uid);
 await helper.send(MSG.KICK_SUCCESS.replace("{name}", name));
 }
}

async function handleKickByNameOrUID(helper, args) {
 const input = args.join(" ").replace(/^@/, "").trim();
 
 let user = null;
 
 // Thử tìm theo UID
 if (CONFIG.ALLOW_KICK_BY_UID && /^\d+$/.test(input)) {
 user = helper.findUserByUID(input);
 }
 
 // Thử tìm theo tên
 if (!user) {
 user = helper.findUserByName(input);
 }

 if (!user) {
 return helper.send(MSG.USER_NOT_FOUND);
 }

 const check = helper.canKick(user.id);
 if (!check.ok) {
 return helper.send(check.msg);
 }

 const result = await helper.kickUser(user.id);
 if (result.success && CONFIG.SHOW_SUCCESS_MSG) {
 await helper.send(MSG.KICK_SUCCESS.replace("{name}", user.name));
 }
}

async function handleKickAll(helper) {
 const listUserID = helper.threadInfo.participantIDs.filter(
 id => id != helper.botID && 
 id != helper.senderID && 
 !helper.adminIDs.includes(id)
 );

 if (listUserID.length === 0) {
 return helper.send("⚠️ Không có thành viên nào để kick!");
 }

 await helper.send(MSG.KICK_ALL_START.replace("{count}", listUserID.length));

 let success = 0;
 for (const uid of listUserID) {
 const result = await helper.kickUser(uid);
 if (result.success) success++;
 await new Promise(r => setTimeout(r, CONFIG.KICK_ALL_DELAY));
 }

 await helper.send(
 MSG.KICK_ALL_DONE
 .replace("{success}", success)
 .replace("{total}", listUserID.length)
 );
}

// ==================== MAIN FUNCTION ====================
module.exports.run = async function ({ args, api, event }) {
 try {
 const threadInfo = await api.getThreadInfo(event.threadID);
 const helper = new KickHelper(api, event, threadInfo);

 // Kiểm tra quyền
 const permCheck = helper.checkPermissions();
 if (!permCheck.ok) {
 return helper.send(permCheck.msg);
 }

 const mentions = event.mentions || {};

 // 1. KICK BẰNG TAG
 if (Object.keys(mentions).length > 0) {
 return handleKickByMentions(helper, mentions);
 }

 // 2. KICK BẰNG REPLY
 if (event.type === "message_reply") {
 return handleKickByReply(helper);
 }

 // 3. KICK ALL
 if (args[0] === "all") {
 return handleKickAll(helper);
 }

 // 4. KICK BẰNG TÊN HOẶC UID
 if (args.length > 0) {
 return handleKickByNameOrUID(helper, args);
 }

 // 5. THIẾU THAM SỐ
 return helper.send(MSG.INVALID_USAGE);

 } catch (e) {
 console.error("KICK ERROR:", e);
 return api.sendMessage(
 "❌ Đã xảy ra lỗi! Vui lòng thử lại.",
 event.threadID,
 event.messageID
 );
 }
};