const fs = require("fs-extra");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

// --- ĐĂNG KÝ FONT ĐỘC QUYỀN ---
const fontPath = path.join(__dirname, "Roboto-Bold.ttf");
if (fs.existsSync(fontPath)) {
 registerFont(fontPath, { family: "HNhannFont" });
}
const FONT = "HNhannFont, sans-serif";

module.exports.config = {
 name: "kickall",
 version: "6.0.0",
 hasPermssion: 1,
 credits: "HNhann Studio",
 description: "Kick Dashboard - Fix Font Luxury HNHANN STUDIO",
 commandCategory: "quản trị viên",
 usages: "[all]",
 cooldowns: 10
};

async function drawKickImage(threadID, memberList, isResult = false) {
 const startX = 100, startY = 320, rowH = 75, colCount = 3;
 const rowCount = Math.ceil(memberList.length / colCount);
 const dynamicHeight = Math.max(1080, startY + (rowCount * rowH) + 180);
 const width = 1920;

 const canvas = createCanvas(width, dynamicHeight);
 const ctx = canvas.getContext("2d");

 const bg = ctx.createLinearGradient(0, 0, 0, dynamicHeight);
 bg.addColorStop(0, "#05060a");
 bg.addColorStop(1, isResult ? "#0a150a" : "#150a0a");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, width, dynamicHeight);

 // --- FIX FONT HNHANN STUDIO ---
 ctx.textAlign = "left";
 ctx.fillStyle = isResult ? "#00FF7F" : "#FF4D4D";
 ctx.font = `bold 85px ${FONT}`; // Giảm cỡ chữ tiêu đề chính để thoáng hơn
 ctx.fillText(isResult ? "KICK SUCCESSFUL" : "KICK MEMBER MANAGER", 100, 150);
 
 // Thương hiệu HNHANN STUDIO (Căn chỉnh lại khoảng cách)
 ctx.textAlign = "right";
 ctx.fillStyle = "#FFFFFF";
 ctx.font = `bold 55px ${FONT}`;
 ctx.fillText("HNHANN STUDIO", 1820, 140); 

 ctx.textAlign = "left";
 ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
 ctx.font = `35px ${FONT}`;
 ctx.fillText(isResult ? `ĐÃ LOẠI BỎ: ${memberList.length} THÀNH VIÊN` : `DANH SÁCH ĐỐI TƯỢNG: ${memberList.length} NGƯỜI`, 110, 220);

 const colW = 580;
 ctx.font = `bold 28px ${FONT}`;

 memberList.forEach((mem, index) => {
 const col = index % colCount;
 const row = Math.floor(index / colCount);
 const x = startX + (col * colW);
 const y = startY + (row * rowH);

 ctx.fillStyle = isResult ? "#00FF7F" : "#FF4D4D";
 ctx.fillText(`${index + 1}.`, x, y);
 ctx.fillStyle = "#FFFFFF";
 const displayName = mem.name.length > 25 ? mem.name.substring(0, 22) + "..." : mem.name;
 ctx.fillText(displayName, x + 65, y);
 });

 const cachePath = path.join(__dirname, "cache", `kick_${Date.now()}.png`);
 fs.writeFileSync(cachePath, canvas.toBuffer());
 return cachePath;
}

module.exports.run = async function ({ api, event, args, Threads }) {
 const { threadID, messageID, senderID } = event;
 const botID = api.getCurrentUserID();
 const adminBot = global.config.ADMINBOT || [];

 const threadInfo = await Threads.getInfo(threadID);
 const qtvIDs = threadInfo.adminIDs.map(id => id.id);

 const listToKick = threadInfo.participantIDs.filter(id => 
 id != botID && !qtvIDs.includes(id) && !adminBot.includes(id)
 );

 if (listToKick.length == 0) return api.sendMessage("❌ Không có thành viên thường để kick.", threadID, messageID);

 const memberList = [];
 for (const id of listToKick) {
 try {
 const info = await api.getUserInfo(id);
 memberList.push({ id, name: info[id].name });
 } catch(e) { memberList.push({ id, name: "Người dùng Facebook" }); }
 }

 const pathImg = await drawKickImage(threadID, memberList, false);

 return api.sendMessage({
 body: `💿 [ HNHANN STUDIO ]`,
 attachment: fs.createReadStream(pathImg)
 }, threadID, (err, info) => {
 global.client.handleReply.push({
 name: this.config.name,
 messageID: info.messageID,
 author: senderID,
 memberList
 });
 if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
 }, messageID);
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
 const { threadID, messageID, body, senderID } = event;
 if (handleReply.author != senderID) return;
 const { memberList } = handleReply;

 api.unsendMessage(handleReply.messageID).catch(() => {});

 let targets = [];
 if (body.trim().toLowerCase() == 'all') {
 targets = memberList;
 } else {
 const choices = [...new Set(body.split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= memberList.length))];
 if (choices.length === 0) return;
 targets = choices.map(i => memberList[i - 1]);
 }

 const kickedList = [];
 for (const mem of targets) {
 try {
 await api.removeUserFromGroup(mem.id, threadID);
 kickedList.push(mem);
 await new Promise(r => setTimeout(r, 700)); 
 } catch (e) { console.log(`Lỗi: ${mem.id}`); }
 }

 if (kickedList.length > 0) {
 const pathResult = await drawKickImage(threadID, kickedList, true);
 return api.sendMessage({
 body: `✅ [ HNHANN STUDIO - UPDATE ]`,
 attachment: fs.createReadStream(pathResult)
 }, threadID, () => {
 if (fs.existsSync(pathResult)) fs.unlinkSync(pathResult);
 }, messageID);
 }
};