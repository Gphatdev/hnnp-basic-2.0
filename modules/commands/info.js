const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const { createCanvas, loadImage } = require("canvas");

const cachePath = path.join(__dirname, "cache_info");
fs.ensureDirSync(cachePath);

module.exports.config = {
 name: "info",
 version: "12.0.0",
 hasPermssion: 0,
 credits: "HNhann",
 description: "Check thông tin Profile FB ảnh Dashboard - Thuật toán đoán giới tính + Biệt danh nâng cao",
 commandCategory: "Utility",
 usages: "[trống / tag / reply / UID]",
 cooldowns: 5
};

// ================= THUẬT TOÁN ĐOÁN GIỚI TÍNH NÂNG CAO VIP =================
function guessGenderByName(name) {
 if (!name || typeof name !== "string") return "Chưa Tìm Thấy";
 
 // Chuẩn hóa chữ thường và tách từ bằng Regex (bóc tách toàn bộ dấu ngoặc đơn, ngoặc vuông, kí tự đặc biệt)
 let normalized = name.toLowerCase().trim();
 const words = normalized.split(/[\s()\[\]_.\-+★•~|@#]+/).filter(Boolean);
 if (words.length === 0) return "Chưa Tìm Thấy";

 // 1. BỘ LỌC BIỆT DANH ĐỘC QUYỀN (Ưu tiên quét trước)
 const femaleNicks = ["dâu", "dau", "bống", "bong", "nấm", "nam", "mèo", "meo", "thỏ", "tho", "sứa", "sua", "heo", "mun", "bông", "bong", "suka", "kem", "gạo", "gao", "bắp", "bap"];
 const maleNicks = ["cu", "tí", "ti", "tèo", "teo", "thằng", "thang", "đực", "duc", "gấu", "gau", "bin", "bo", "bắp", "bap"];

 for (let word of words) {
 if (femaleNicks.includes(word)) return "Nữ";
 if (maleNicks.includes(word)) return "Nam";
 }

 // 2. TỪ LÓT ĐẶC TRƯNG VIỆT NAM (Có dấu & Không dấu)
 if (words.includes("thị") || words.includes("thi")) return "Nữ";
 if (words.includes("văn") || words.includes("van")) return "Nam";

 // 3. TRÍ TUỆ NHÂN TẠO PHÂN TÍCH TÊN CHÍNH (Từ cuối cùng của tên)
 let firstName = words[words.length - 1];

 const femaleFirstNames = [
 "nhi", "vy", "quỳnh", "quynh", "trang", "thảo", "thao", "hương", "huong", "huyền", "huyen", 
 "mai", "lan", "hạnh", "hanh", "tuyết", "tuyet", "oanh", "nga", "phượng", "phuong", "dung", 
 "yến", "yen", "anh", "linh", "trinh", "chi", "bích", "bich", "ngọc", "ngoc", "tú", "tu", 
 "châu", "chau", "vi", "diệp", "diep", "liên", "lien", "hoa", "khánh", "khanh", "phương", 
 "nhung", "ly", "lê", "le", "ngân", "ngan", "tâm", "tam", "trà", "tra", "ca", "mơ", "mo",
 "diệu", "dieu", "như", "nhu", "tường", "tuong", "ân", "an", "uyên", "uyen", "thư", "thu", 
 "khuyên", "khuyen", "đan", "dan", "quế", "que", "xoan", "thương", "thuong", "trúc", "truc",
 "vân", "van", "ha", "hà", "diễm", "diem", "kiều", "kieu", "mỹ", "my", "nguyệt", "nguyet", "tiên", "tien"
 ];
 
 const maleFirstNames = [
 "hùng", "hung", "mạnh", "manh", "tuấn", "tuan", "hoàng", "hoang", "hải", "hai", "sơn", "son", 
 "tùng", "tung", "long", "thành", "thanh", "trung", "kiên", "kien", "tiến", "tien", "công", "cong", 
 "dương", "duong", "đạt", "dat", "quân", "quan", "phong", "bách", "bach", "khang", "phúc", "phuc", 
 "nguyên", "nguyen", "vũ", "vu", "bảo", "bao", "minh", "nam", "kiệt", "kiet", "huy", "hoà", "hoa", 
 "thắng", "thang", "toàn", "toan", "duy", "tân", "tan", "vinh", "bình", "binh", "bắc", "bac",
 "nghĩa", "nghia", "trí", "tri", "đức", "duc", "quốc", "quoc", "gia", "phước", "phuoc", "trọng", "trong", 
 "chí", "chi", "đăng", "dang", "khôi", "khoi", "nhân", "nhan", "lâm", "lam", "vương", "vuong", 
 "luân", "luan", "lộc", "loc", "phát", "phat", "cường", "cuong", "hữu", "huu", "quảng", "quang"
 ];

 if (femaleFirstNames.includes(firstName)) return "Nữ";
 if (maleFirstNames.includes(firstName)) return "Nam";

 // 4. ĐỐI CHIẾU NGỮ CẢNH TÊN LƯỠNG TÍNH (Ví dụ: Anh, Linh, Tú nếu đi với lót Nam/Nữ)
 if (words.length > 1) {
 const middleName = words[words.length - 2];
 const maleMiddles = ["văn", "van", "đức", "duc", "quốc", "quoc", "hữu", "huu", "hoàng", "hoang", "đăng", "dang", "duy", "tiến", "tien"];
 const femaleMiddles = ["thị", "thi", "thục", "thuc", "mỹ", "my", "diệu", "dieu", "tuyết", "tuyet", "hồng", "hong"];
 
 if (["anh", "linh", "tú", "tu", "khánh", "khanh", "thanh"].includes(firstName)) {
 if (maleMiddles.includes(middleName)) return "Nam";
 if (femaleMiddles.includes(middleName)) return "Nữ";
 }
 }

 // 5. QUÉT TỪ KHÓA MỞ RỘNG TOÀN CHUỖI KHÔNG DẤU
 const femaleKeywords = ["hồng", "hong", "thúy", "thuy", "thuý", "diệu", "dieu", "như", "nhu", "thục", "thuc", "mỹ", "my", "ngọc", "ngoc"];
 const maleKeywords = ["đức", "duc", "quốc", "quoc", "gia", "phước", "phuoc", "trọng", "trong", "chí", "chi", "đăng", "dang", "văn", "van", "hữu", "huu", "đình", "dinh"];

 for (let kw of femaleKeywords) { if (normalized.includes(kw)) return "Nữ"; }
 for (let kw of maleKeywords) { if (normalized.includes(kw)) return "Nam"; }

 return "Chưa Tìm Thấy";
}
// =======================================================================

async function drawProfileCard(targetID, vipData, baseUser) {
 const width = 1200;
 const height = 700;
 const canvas = createCanvas(width, height);
 const ctx = canvas.getContext("2d");

 // --- BACKGROUND CYBERPUNK PREMIUM ---
 const bgGrad = ctx.createLinearGradient(0, 0, width, height);
 bgGrad.addColorStop(0, "#020617");
 bgGrad.addColorStop(0.5, "#0b1329");
 bgGrad.addColorStop(1, "#0f172a");
 ctx.fillStyle = bgGrad;
 ctx.fillRect(0, 0, width, height);

 // Lưới Neon mờ
 ctx.strokeStyle = "rgba(0, 245, 255, 0.015)";
 ctx.lineWidth = 1;
 for (let i = 0; i < width; i += 40) {
 ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
 }

 // --- DỮ LIỆU ĐỒNG BỘ ---
 const fbName = baseUser.name || vipData?.name || "Người dùng Facebook";
 const username = baseUser.vanity || vipData?.username || vipData?.vanity || "Chưa Tìm Thấy";
 const bioText = vipData?.bio || vipData?.biography || vipData?.about || vipData?.profile_bio || "Chưa Tìm Thấy";
 
 // Tính toán ngày tạo
 let creationDate = "Chưa Tìm Thấy";
 if (vipData?.created_time) {
 creationDate = moment(vipData.created_time).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY");
 } else if (vipData?.created_at) {
 creationDate = moment(vipData.created_at).format("DD/MM/YYYY");
 } else {
 const uidNum = parseInt(targetID);
 if (!isNaN(uidNum)) {
 if (uidNum < 100000000) creationDate = "Trước năm 2009 (Cổ)";
 else if (uidNum < 100000000000) creationDate = "Khoảng 2009 - 2012";
 else if (targetID.startsWith("10000")) creationDate = "Khoảng 2012 - 2015";
 else if (targetID.startsWith("10001")) creationDate = "Khoảng 2015 - 2017";
 else if (targetID.startsWith("10002") || targetID.startsWith("10003")) creationDate = "Khoảng 2017 - 2019";
 else if (targetID.startsWith("10004") || targetID.startsWith("10005")) creationDate = "Khoảng 2019 - 2021";
 else if (uidNum > 100060000000000) creationDate = "Khoảng 2022 - Nay";
 }
 }

 let followers = "Chưa Tìm Thấy";
 const rawFollowers = vipData?.followers || vipData?.subscribers?.summary?.total_count || vipData?.follower_count || vipData?.follow_count;
 if (rawFollowers) {
 followers = isNaN(rawFollowers) ? `${rawFollowers}` : `${parseInt(rawFollowers).toLocaleString("vi-VN")} người`;
 }

 // 🔥 KÍCH HOẠT THUẬT TOÁN ĐOÁN GIỚI TÍNH CẢI TIẾN VIP TẦNG 3
 let genderText = "Chưa Tìm Thấy";
 const rawGender = baseUser.gender !== undefined ? baseUser.gender : vipData?.gender;
 
 if (rawGender === "male" || rawGender === 2 || rawGender === "Nam") {
 genderText = "Nam";
 } else if (rawGender === "female" || rawGender === 1 || rawGender === "Nữ") {
 genderText = "Nữ";
 } else {
 genderText = guessGenderByName(fbName);
 }

 const hometown = vipData?.hometown?.name || vipData?.hometown || vipData?.hometown_name || "Chưa Tìm Thấy";
 const location = vipData?.location?.name || vipData?.current_city || vipData?.location_name || "Chưa Tìm Thấy";
 const relationship = vipData?.relationship_status || vipData?.relationship || "Chưa Tìm Thấy";

 // --- TẢI AVATAR ---
 let avatarImg;
 try {
 avatarImg = await loadImage(`https://graph.facebook.com/${targetID}/picture?width=500&height=500`);
 } catch (e) {
 try {
 avatarImg = baseUser.thumbSrc ? await loadImage(baseUser.thumbSrc) : await loadImage(`https://graph.facebook.com/${targetID}/picture?type=large`);
 } catch (err) {
 avatarImg = await loadImage("https://i.imgur.com/7k7wbeY.png");
 }
 }

 // Vẽ Avatar
 ctx.save();
 const avX = 80, avY = 80, avW = 320, avH = 320, avR = 24;
 roundRect(ctx, avX, avY, avW, avH, avR);
 ctx.clip();
 ctx.drawImage(avatarImg, avX, avY, avW, avH);
 ctx.restore();

 ctx.strokeStyle = "#00F5FF";
 ctx.lineWidth = 4;
 roundRect(ctx, avX, avY, avW, avH, avR);
 ctx.stroke();

 ctx.fillStyle = "#FFFFFF";
 ctx.textAlign = "left";
 ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
 ctx.fillText(fbName, 80, 460, 320);

 ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
 ctx.font = "500 20px 'Segoe UI', Arial, sans-serif";
 ctx.fillText(username !== "Chưa Tìm Thấy" ? `@${username}` : username, 80, 500, 320);

 ctx.fillStyle = "rgba(0, 245, 255, 0.08)";
 roundRect(ctx, 80, 530, 320, 46, 10);
 ctx.fill();
 ctx.strokeStyle = "rgba(0, 245, 255, 0.2)";
 ctx.lineWidth = 1;
 roundRect(ctx, 80, 530, 320, 46, 10);
 ctx.stroke();
 
 ctx.fillStyle = "#00F5FF";
 ctx.font = "bold 19px monospace";
 ctx.textAlign = "center";
 ctx.fillText(`UID: ${targetID}`, 240, 559);

 // --- KHUNG DASHBOARD PHẢI ---
 const boxX = 450, boxY = 80, boxW = 670, boxH = 540, boxR = 24;
 ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
 roundRect(ctx, boxX, boxY, boxW, boxH, boxR);
 ctx.fill();
 ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
 ctx.lineWidth = 1.5;
 ctx.stroke();

 ctx.fillStyle = "#00F5FF";
 ctx.textAlign = "left";
 ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
 ctx.fillText("HỒ SƠ ĐIỆN TỬ USER VERIFIED", boxX + 40, boxY + 50);

 const fields = [
 { icon: "📝", label: "TIỂU SỬ", value: bioText, color: "#FFD600" },
 { icon: "📅", label: "NGÀY TẠO", value: creationDate, color: "#00E5FF" },
 { icon: "📊", label: "THEO DÕI", value: followers, color: "#FF1744" },
 { icon: "⚧️", label: "GIỚI TÍNH", value: genderText, color: "#D500F9" },
 { icon: "🏡", label: "QUÊ QUÁN", value: hometown, color: "#00E676" },
 { icon: "📍", label: "NƠI SỐNG", value: location, color: "#FF5252" },
 { icon: "💍", label: "HÔN NHÂN", value: relationship, color: "#FF4081" }
 ];

 const startY = boxY + 115;
 const stepY = 58;

 fields.forEach((field, index) => {
 const currY = startY + (index * stepY);

 ctx.fillStyle = field.color;
 ctx.textAlign = "left";
 ctx.font = "24px 'Segoe UI'";
 ctx.fillText(field.icon, boxX + 40, currY);

 ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
 ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
 ctx.fillText(field.label, boxX + 85, currY - 4);

 if (field.value === "Chưa Tìm Thấy") {
 ctx.fillStyle = "rgba(239, 68, 68, 0.55)"; 
 ctx.font = "italic 500 21px 'Segoe UI', Arial, sans-serif";
 } else {
 ctx.fillStyle = "#E2E8F0";
 ctx.font = "600 21px 'Segoe UI', Arial, sans-serif";
 }
 ctx.fillText(field.value, boxX + 225, currY - 3, boxW - 255);
 });

 return canvas.toBuffer();
}

function roundRect(ctx, x, y, w, h, r) {
 ctx.beginPath();
 ctx.moveTo(x + r, y);
 ctx.arcTo(x + w, y, x + w, y + h, r);
 ctx.arcTo(x + w, h + y, x, h + y, r);
 ctx.arcTo(x, h + y, x, y, r);
 ctx.arcTo(x, y, x + w, y, r);
 ctx.closePath();
}

module.exports.run = async ({ api, event, args }) => {
 const { threadID, messageID, senderID, type, messageReply, mentions } = event;
 
 let targetID;
 if (type === "message_reply") {
 targetID = messageReply.senderID;
 } else if (Object.keys(mentions).length > 0) {
 targetID = Object.keys(mentions)[0];
 } else if (args[0]) {
 targetID = args[0];
 } else {
 targetID = senderID;
 }

 if (isNaN(targetID) || targetID.length < 5) {
 return api.sendMessage("⚠️ UID mục tiêu không hợp lệ!", threadID, messageID);
 }

 const loadingMsg = await new Promise(resolve => {
 api.sendMessage("⚙️ Đang đồng bộ cấu trúc Multi-API & chạy quét AI nhận diện biệt danh...", threadID, (err, info) => resolve(info), messageID);
 });

 let vipData = null;

 const endpoints = [
 `https://api.nguyenmanh.name.vn/fb/info?uid=${targetID}`,
 `https://api.sumiproject.net/facebook/info?uid=${targetID}`,
 `https://graph.facebook.com/${targetID}/?fields=name,username,biography,subscribers.limit(0),hometown,location,relationship_status&access_token=1073911566416173|9f4b12f84c123cc23437a4a32`
 ];

 for (let url of endpoints) {
 try {
 const res = await axios.get(url, { timeout: 3000 });
 let data = res.data?.data || res.data?.result || res.data;
 if (data && (data.id || data.uid || data.name)) {
 vipData = data;
 break; 
 }
 } catch (e) {
 continue; 
 }
 }

 try {
 const fcaRes = await api.getUserInfo(targetID);
 const baseUser = fcaRes[targetID] || {};

 const buffer = await drawProfileCard(targetID, vipData, baseUser);
 const pathImg = path.join(cachePath, `dashboard_v12_${targetID}.png`);
 fs.writeFileSync(pathImg, buffer);

 if (loadingMsg && api.unsendMessage) {
 api.unsendMessage(loadingMsg.messageID).catch(() => {});
 }

 return api.sendMessage({
 body: `⚡ Trích xuất hoàn tất hồ sơ ID: ${targetID}`,
 attachment: fs.createReadStream(pathImg)
 }, threadID, () => {
 if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
 }, messageID);

 } catch (err) {
 console.error(err);
 if (loadingMsg && api.unsendMessage) api.unsendMessage(loadingMsg.messageID).catch(() => {});
 return api.sendMessage("❌ Hệ thống đồ họa Canvas gặp sự cố trong lúc vẽ ảnh!", threadID, messageID);
 }
};