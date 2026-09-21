const fs = require("fs");
const path = require("path");

module.exports.config = {
 name: "banbox",
 version: "1.0.0",
 hasPermssion: 2, // Chỉ Admin/NDH mới được dùng
 credits: "HNHANN STUDIO",
 description: "Bật/tắt ban box (chặn cả QTV và thành viên) lưu vào cache",
 commandCategory: "Admin",
 usages: "on / off [threadID]",
 cooldowns: 5
};

module.exports.onLoad = () => {
 const cachePath = path.join(__dirname, "cache", "banbox.json");
 // Tự động tạo file cache nếu chưa tồn tại
 if (!fs.existsSync(cachePath)) fs.writeFileSync(cachePath, JSON.stringify({}));
};

module.exports.run = async ({ api, event, args }) => {
 const { threadID, messageID } = event;
 const cachePath = path.join(__dirname, "cache", "banbox.json");

 let banData = {};
 try {
 banData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
 } catch (e) {}

 const action = args[0] ? args[0].toLowerCase() : "";
 // Lấy ID nhóm hiện tại hoặc ID nhóm được chỉ định
 const targetThread = args[1] || threadID; 

 if (action === "on") {
 banData[targetThread] = true;
 fs.writeFileSync(cachePath, JSON.stringify(banData, null, 4));
 return api.sendMessage(
 `🔒 Đã bật BAN BOX đối với nhóm ${targetThread}.\n\n⚠️ Toàn bộ thành viên và QTV nhóm này sẽ không thể sử dụng bot!`, 
 threadID, 
 messageID
 );
 } else if (action === "off") {
 if (banData[targetThread]) {
 delete banData[targetThread];
 fs.writeFileSync(cachePath, JSON.stringify(banData, null, 4));
 return api.sendMessage(
 `🔓 Đã gỡ BAN BOX cho nhóm ${targetThread}.\n\n✅ Nhóm có thể sử dụng bot bình thường!`, 
 threadID, 
 messageID
 );
 } else {
 return api.sendMessage(`⚠️ Nhóm ${targetThread} hiện không nằm trong danh sách bị ban!`, threadID, messageID);
 }
 } else {
 return api.sendMessage("❎ Cú pháp không hợp lệ.\n\n👉 Hướng dẫn: dùng lệnh 'banbox on' để cấm nhóm hoặc 'banbox off' để mở cấm.", threadID, messageID);
 }
};