const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const DATA_ROOT = path.join(__dirname, "data", "hsg");
const limitPath = path.join(__dirname, "..", "commands", "cache", "limit.json");
const REMOVEBG_API_KEY = ""; // có api xoá nền thì gắn vào 

async function removeBackground(imageUrl) {
 try {
 const FormData = require("form-data");
 const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
 const imgBuffer = Buffer.from(imgResp.data);

 const form = new FormData();
 form.append("image", imgBuffer, { filename: "image.png", contentType: "image/png" });

 const response = await axios.post(
 "https://legistudio.net/api-legi/removebg", // thay đổi url web api xoá nền !
 form,
 {
 headers: { ...form.getHeaders(), "x-api-key": REMOVEBG_API_KEY },
 responseType: "arraybuffer",
 timeout: 20000,
 }
 );
 console.log(`[HSG] Xóa nền thành công`);
 return { buffer: Buffer.from(response.data), success: true };
 } catch (error) {
 console.warn("[HSG] Xóa nền thất bại, dùng ảnh gốc:", error.message);
 try {
 const originalImageResponse = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 15000 });
 return { buffer: Buffer.from(originalImageResponse.data), success: false };
 } catch (e) {
 console.error("[HSG] Lỗi tải ảnh gốc:", e.message);
 return { buffer: null, success: false };
 }
 }
}

function getUserDir(uid) {
 return path.join(DATA_ROOT, uid.toString());
}

function getDataFile(uid) {
 return path.join(getUserDir(uid), "hsg.json");
}

function readData(uid) {
 const file = getDataFile(uid);
 if (!fs.existsSync(file)) return {};
 try {
 return fs.readJsonSync(file);
 } catch {
 return {};
 }
}

function writeData(uid, data) {
 const dir = getUserDir(uid);
 fs.ensureDirSync(dir);
 fs.writeJsonSync(getDataFile(uid), data, { spaces: 2 });
}

// Chuẩn hóa tên team: UPPERCASE, bỏ khoảng trắng thừa
function normalizeName(name) {
 return name.trim().toUpperCase();
}
module.exports.config = {
 name: "hsg",
 version: "1.0",
 hasPermssion: 0,
 credits: "GiaPhat dev", // chỉ có xúc vật mới đổi credits tao (e vẫn cứ đổi kkk)
 description: "Quản lý logo team — thêm logo không cần ID, check logo theo tên team từ trận đấu.",
 commandCategory: "game",
 usages: "[add|check|list|remove|clear]",
 cooldowns: 5,
};
module.exports.run = async function ({ api, event, args }) {
 const { threadID, messageID, messageReply, senderID } = event;

 // Kiểm tra giới hạn box
 try {
 const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
 const threadLimit = limitData[threadID];
 if (threadLimit && threadLimit.game === false) {
 return api.sendMessage(
 "❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'",
 threadID, messageID
 );
 }
 } catch (e) {
 console.log("[HSG] Lỗi đọc limit.json:", e.message);
 }

 if (!args[0]) {
 return api.sendMessage(
 "📌 Hướng dẫn lệnh hsg:\n\n" +
 "• hsg add [Tên Team] + đính kèm ảnh → Lưu logo team (tự tách nền)\n" +
 "• hsg check [Tên Team] → Gửi logo của team đó\n" +
 "• hsg list → Xem danh sách team đã lưu\n" +
 "• hsg remove [Tên Team] → Xóa logo team\n" +
 "• hsg clear → Xóa toàn bộ dữ liệu của bạn",
 threadID, messageID
 );
 }

 const cmd = args[0].toLowerCase();
 const uid = senderID;
 let data = readData(uid);
 if (["add", "them", "tao"].includes(cmd)) {
 const teamName = normalizeName(args.slice(1).join(" "));

 if (!teamName) {
 return api.sendMessage(
 "⚠️ Vui lòng nhập tên team!\nVD: hsg add TÊN TEAM (kèm ảnh logo)",
 threadID, messageID
 );
 }

 const attachments = (messageReply?.attachments || []).filter(
 (a) => a.type === "photo" || a.type === "sticker"
 );
 if (!attachments.length) {
 // Nếu team chưa tồn tại, tạo mới không có logo
 if (!data[teamName]) {
 data[teamName] = { logo: null, addedAt: Date.now() };
 writeData(uid, data);
 return api.sendMessage(
 `✅ Đã tạo hồ sơ team:\n⭐ Team: ${teamName}\n🖼 Logo: Chưa có (reply ảnh + hsg add ${teamName} để thêm logo)`,
 threadID, messageID
 );
 } else {
 return api.sendMessage(
 `⚠️ Team "${teamName}" đã tồn tại.\n🖼 Logo: ${data[teamName].logo ? "Đã có" : "Chưa có"}\n\nĐể cập nhật logo: reply ảnh + hsg add ${teamName}`,
 threadID, messageID
 );
 }
 }
 api.sendMessage("⏳ Đang tách nền logo, vui lòng chờ...", threadID);

 const attachment = attachments[0];
 const dest = path.join(getUserDir(uid), `${Date.now()}_${teamName.replace(/\s/g, "_")}.png`);
 fs.ensureDirSync(getUserDir(uid));

 const { buffer: imageBuffer, success: bgSuccess } = await removeBackground(attachment.url);

 if (!imageBuffer) {
 return api.sendMessage(
 `❌ Không thể tải ảnh logo cho team ${teamName}. Vui lòng thử lại!`,
 threadID, messageID
 );
 }

 if (data[teamName]?.logo && fs.existsSync(data[teamName].logo)) {
 try { fs.unlinkSync(data[teamName].logo); } catch {}
 }

 fs.writeFileSync(dest, imageBuffer);
 data[teamName] = { logo: dest, addedAt: Date.now() };
 writeData(uid, data);

 const logoStatus = bgSuccess ? "Đã lưu (đã tách nền ✨)" : "Đã lưu (ảnh gốc)";
 return api.sendMessage(
 `✅ Đã lưu logo team thành công!\n` +
 `⭐ Team: ${teamName}\n` +
 `🖼 Logo: ${logoStatus}`,
 threadID, messageID
 );
 }
 if (["check", "xem", "lay"].includes(cmd)) {
 const teamName = normalizeName(args.slice(1).join(" "));

 if (!teamName) {
 return api.sendMessage(
 "⚠️ Vui lòng nhập tên team cần check!\nVD: hsg check TÊN TEAM",
 threadID, messageID
 );
 }
 if (data[teamName]) {
 const team = data[teamName];
 if (team.logo && fs.existsSync(team.logo)) {
 return api.sendMessage(
 {
 body: `🖼 Logo team: ${teamName}\n📅 Lưu lúc: ${new Date(team.addedAt).toLocaleString("vi-VN")}`,
 attachment: fs.createReadStream(team.logo),
 },
 threadID, messageID
 );
 } else {
 return api.sendMessage(
 `⚠️ Team "${teamName}" đã lưu nhưng chưa có logo.\nReply ảnh + hsg add ${teamName} để thêm logo!`,
 threadID, messageID
 );
 }
 }
 const keys = Object.keys(data);
 const fuzzy = keys.filter(
 (k) => k.includes(teamName) || teamName.includes(k)
 );

 if (fuzzy.length === 1) {
 const found = fuzzy[0];
 const team = data[found];
 if (team.logo && fs.existsSync(team.logo)) {
 return api.sendMessage(
 {
 body: `🖼 Logo team: ${found}\n(Tìm gần đúng cho "${teamName}")\n📅 Lưu lúc: ${new Date(team.addedAt).toLocaleString("vi-VN")}`,
 attachment: fs.createReadStream(team.logo),
 },
 threadID, messageID
 );
 } else {
 return api.sendMessage(
 `⚠️ Tìm thấy team gần đúng "${found}" nhưng chưa có logo.`,
 threadID, messageID
 );
 }
 }

 if (fuzzy.length > 1) {
 return api.sendMessage(
 `🔍 Tìm thấy ${fuzzy.length} team gần đúng:\n${fuzzy.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nVui lòng nhập chính xác tên team!`,
 threadID, messageID
 );
 }

 return api.sendMessage(
 `❌ Không tìm thấy logo của team "${teamName}".\nDùng hsg add ${teamName} + đính kèm ảnh để thêm logo!`,
 threadID, messageID
 );
 }

 if (["list", "danhsach", "ds"].includes(cmd)) {
 const keys = Object.keys(data);
 if (!keys.length) {
 return api.sendMessage(
 "📌 Bạn chưa lưu logo team nào.\nDùng: hsg add [Tên Team] + đính kèm ảnh",
 threadID, messageID
 );
 }

 const pageSize = 15;
 let page = parseInt(args[1]) || 1;
 const totalPage = Math.ceil(keys.length / pageSize);
 if (page < 1) page = 1;
 if (page > totalPage) page = totalPage;

 const start = (page - 1) * pageSize;
 const showKeys = keys.slice(start, start + pageSize);

 let msg = `📋 Danh sách logo team của bạn (Trang ${page}/${totalPage}):\n\n`;
 showKeys.forEach((team, idx) => {
 const hasLogo = data[team].logo && fs.existsSync(data[team].logo);
 msg += `${start + idx + 1}. ${team} ${hasLogo ? "🖼" : "❌"}\n`;
 });
 msg += `\n🖼 = Có logo ❌ = Chưa có logo`;
 if (totalPage > 1) msg += `\nDùng: hsg list [trang] để xem trang khác`;

 return api.sendMessage(msg, threadID, messageID);
 }

 if (["remove", "rm", "xoa", "del"].includes(cmd)) {
 const teamName = normalizeName(args.slice(1).join(" "));

 if (!teamName) {
 return api.sendMessage("⚠️ Vui lòng nhập tên team cần xóa!", threadID, messageID);
 }

 if (!data[teamName]) {
 return api.sendMessage(`❌ Không tìm thấy team "${teamName}"!`, threadID, messageID);
 }

 // Xóa file logo nếu có
 if (data[teamName].logo && fs.existsSync(data[teamName].logo)) {
 try { fs.unlinkSync(data[teamName].logo); } catch {}
 }

 delete data[teamName];
 writeData(uid, data);

 return api.sendMessage(`🗑️ Đã xóa logo team "${teamName}" thành công!`, threadID, messageID);
 }

 if (["clear", "xoaall"].includes(cmd)) {
 const userDir = getUserDir(uid);
 try {
 fs.removeSync(userDir);
 } catch {}
 return api.sendMessage("🗑️ Đã xóa toàn bộ dữ liệu logo team của bạn!", threadID, messageID);
 }

 return api.sendMessage(
 "⚠️ Lệnh không hợp lệ!\nDùng: add | check | list | remove | clear",
 threadID, messageID
 );
};

// ========== EXPORTED HELPER cho lệnh td hoặc các lệnh khác ==========
/**
 * Tìm logo của một team theo tên, quét toàn bộ user đã lưu.
 * Trả về: { logoPath, ownerUID, teamName } hoặc null nếu không tìm thấy.
 */
module.exports.findLogoByTeamName = function (teamName) {
 if (!fs.existsSync(DATA_ROOT)) return null;
 const normalized = teamName.trim().toUpperCase();

 try {
 const userDirs = fs.readdirSync(DATA_ROOT);
 for (const uid of userDirs) {
 const dataFile = path.join(DATA_ROOT, uid, "hsg.json");
 if (!fs.existsSync(dataFile)) continue;
 let data;
 try { data = fs.readJsonSync(dataFile); } catch { continue; }

 // Tìm chính xác
 if (data[normalized]?.logo && fs.existsSync(data[normalized].logo)) {
 return { logoPath: data[normalized].logo, ownerUID: uid, teamName: normalized };
 }

 // Tìm gần đúng
 const fuzzy = Object.keys(data).find(
 (k) => k.includes(normalized) || normalized.includes(k)
 );
 if (fuzzy && data[fuzzy]?.logo && fs.existsSync(data[fuzzy].logo)) {
 return { logoPath: data[fuzzy].logo, ownerUID: uid, teamName: fuzzy };
 }
 }
 } catch (e) {
 console.error("[HSG] findLogoByTeamName lỗi:", e.message);
 }

 return null;
};

module.exports.findLogoByUID = function (uid, teamName) {
 const normalized = teamName.trim().toUpperCase();
 const dataFile = path.join(DATA_ROOT, uid.toString(), "hsg.json");
 if (!fs.existsSync(dataFile)) return null;

 let data;
 try { data = fs.readJsonSync(dataFile); } catch { return null; }

 if (data[normalized]?.logo && fs.existsSync(data[normalized].logo)) {
 return data[normalized].logo;
 }
 const fuzzy = Object.keys(data).find(
 (k) => k.includes(normalized) || normalized.includes(k)
 );
 if (fuzzy && data[fuzzy]?.logo && fs.existsSync(data[fuzzy].logo)) {
 return data[fuzzy].logo;
 }

 return null;
};