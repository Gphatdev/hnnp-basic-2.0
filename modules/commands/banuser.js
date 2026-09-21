module.exports = {
 config: {
 name: "banuser",
 version: "1.5.0",
 hasPermssion: 2, // 2 hoặc 3 tùy core
 credits: "Gemini",
 description: "Cấm người dùng (Cache + Admin/NDH + Fix lỗi @tag chuẩn từ kick)",
 commandCategory: "Hệ thống Admin",
 usages: "[reply/tag/UID/tên] [lý do]",
 cooldowns: 3
 },

 onLoad: function() {
 const fs = require("fs");
 const path = require("path");
 const cacheDir = path.join(__dirname, "cache");
 const cacheFile = path.join(cacheDir, "bannedUsers.json");

 if (!fs.existsSync(cacheDir)) {
 fs.mkdirSync(cacheDir, { recursive: true });
 }
 if (!fs.existsSync(cacheFile)) {
 fs.writeFileSync(cacheFile, JSON.stringify({}), "utf-8");
 }
 },

 run: async function ({ api, event, args, Users }) {
 const moment = require("moment-timezone");
 const fs = require("fs");
 const path = require("path");
 const cacheFile = path.join(__dirname, "cache", "bannedUsers.json");

 const { threadID, messageID, senderID, messageReply, mentions, type } = event;

 // --- 1. KIỂM TRA QUYỀN ---
 const isAdmin = global.config.ADMINBOT.includes(senderID);
 const isNDH = global.config.NDH && global.config.NDH.includes(senderID);

 if (!isAdmin && !isNDH) {
 return api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này!", threadID, messageID);
 }

 let targetIDs = [];
 let reason = "";

 try {
 // --- 2. LẤY ID MỤC TIÊU (Lấy y hệt cấu trúc lệnh KICK) ---
 const threadInfo = await api.getThreadInfo(threadID);

 // ƯU TIÊN 1: Reply tin nhắn (Chuẩn 100%)
 if (type == "message_reply") {
 targetIDs.push(String(messageReply.senderID));
 reason = args.join(" ");
 } 
 // ƯU TIÊN 2: Tag (Nếu FB không lỗi)
 else if (Object.keys(mentions).length > 0) {
 targetIDs = Object.keys(mentions);
 
 // Tách lý do ra khỏi tag
 let fullText = args.join(" ");
 for (const id of targetIDs) {
 fullText = fullText.replace(mentions[id], "");
 }
 reason = fullText.trim();
 }
 // ƯU TIÊN 3: Nhập thẳng UID
 else if (args[0] && !isNaN(args[0])) {
 targetIDs.push(String(args[0]));
 reason = args.slice(1).join(" ");
 }
 // ƯU TIÊN 4: Quét tên (Khi tag bị lỗi thành chữ thô, áp dụng đúng chuẩn lệnh kick)
 else if (args.length > 0) {
 const nameToSearch = args.join(" ").replace(/@/g, ""); // Bỏ dấu @ nếu có
 const allMembers = threadInfo.userInfo;
 
 for (let user of allMembers) {
 if (user.name && user.name.toLowerCase().includes(nameToSearch.toLowerCase())) {
 targetIDs.push(String(user.id));
 }
 }
 reason = "Vi phạm quy định (Hệ thống quét tên do lỗi tag)"; 
 }

 // Xử lý khi không tìm thấy ai
 if (targetIDs.length === 0) {
 return api.sendMessage("❌ Không tìm thấy người này. Cách tốt nhất là hãy REPLY tin nhắn của họ rồi gõ lệnh!", threadID, messageID);
 }

 // --- 3. TIẾN HÀNH BAN & LƯU CACHE ---
 const timeNow = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
 let successReport = [];
 let failReport = [];
 const finalReason = reason || "Không có lý do cụ thể từ Admin/NDH.";

 let cacheData = {};
 try {
 cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
 } catch (e) {
 cacheData = {};
 }

 // Lọc trùng ID
 const uniqueTargets = [...new Set(targetIDs)];

 for (const targetID of uniqueTargets) {
 const isTargetAdmin = global.config.ADMINBOT.includes(targetID);
 const isTargetNDH = global.config.NDH && global.config.NDH.includes(targetID);

 // Phân quyền: Ai được ban ai
 if (isTargetAdmin) {
 failReport.push(`• Không thể ban Admin Bot (${targetID}).`);
 continue;
 }
 if (isNDH && !isAdmin && isTargetNDH) {
 failReport.push(`• Bạn không đủ quyền để ban Người Điều Hành (${targetID}).`);
 continue;
 }

 let infoUser = await Users.getData(targetID) || {};
 let nameUser = infoUser.name || "Người dùng Facebook";

 // Ghi vào dữ liệu core
 global.data.userBanned.set(targetID, { reason: finalReason, dateAdded: timeNow });
 try {
 await Users.setData(targetID, { data: { banned: true, reason: finalReason, dateAdded: timeNow } });
 } catch (e) { console.error(e); }

 // Ghi vào Cache JSON
 cacheData[targetID] = {
 name: nameUser,
 reason: finalReason,
 dateAdded: timeNow,
 bannedBy: senderID
 };

 successReport.push(`• ${nameUser} (${targetID})`);
 }

 fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 4), "utf-8");

 // --- 4. BÁO CÁO KẾT QUẢ ---
 let finalResponse = `🛑 [ HỆ THỐNG BAN USER ]\n━━━━━━━━━━━━━━━━━━━━━\n`;
 if (successReport.length > 0) {
 finalResponse += `✅ ĐÃ BAN THÀNH CÔNG:\n${successReport.join("\n")}\n» Lý do: ${finalReason}\n\n`;
 }
 if (failReport.length > 0) {
 finalResponse += `❌ THẤT BẠI / BỎ QUA:\n${failReport.join("\n")}`;
 }

 return api.sendMessage(finalResponse.trim(), threadID, messageID);

 } catch (error) {
 return api.sendMessage("❌ Đã xảy ra lỗi: " + error.message, threadID, messageID);
 }
 }
};