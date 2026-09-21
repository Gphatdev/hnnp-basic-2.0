/**
 * @name boxscrim
 * @version 7.0.1 (Modular Canvas)
 * @description Tạo ảnh scrim. Dùng chung lượt và limit, tách code vẽ ảnh ra các module riêng.
 * @author Gemini (Modified)
 */

const { registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Gọi 2 module vẽ ảnh mới
const createLuffyImage = require('./boxscrim/canvas_luffy.js');
const createItachiImage = require('./boxscrim/canvas_itachi.js');

// --- CẤU HÌNH TÊN FILE ẢNH NỀN ---
const ITACHI_BG_FILENAME = 'background_itachi.png';
const LUFFY_BG_FILENAME = 'background_luffy.png';

// --- ĐƯỜNG DẪN FILE DỮ LIỆU ---
const turnsPath = path.join(__dirname, 'payment', 'bank_user_turns.json');
const limitPath = path.join(__dirname, 'cache', 'limit.json');

let isAssetsReady = false;

// --- CẤU TRÚC LỆNH ---
module.exports.config = {
    name: "boxscrim",
    version: "7.0.1",
    hasPermssion: 0,
    credits: "Gemini",
    description: `Tạo ảnh scrim. Dùng chung lượt và limit 'game' với lệnh tinhdiem.`,
    commandCategory: "game",
    usages: "[luffy/itachi] | [Tiêu đề] | [Loại phòng] | [Mức giá] | [Dòng 1] | [Dòng 2] | [Banking]",
    cooldowns: 20
};

// --- HÀM TIỆN ÍCH QUẢN LÝ LƯỢT ---
function readJsonFile(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return rawData.length > 0 ? JSON.parse(rawData) : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {}
}

function deductTurns(userID, amount = 1) {
    const data = readJsonFile(turnsPath, {});
    const current = data[userID] || 0;
    if (current < amount) return false;
    data[userID] = current - amount;
    writeJsonFile(turnsPath, data);
    return true;
}

async function getUserName(api, senderID) {
    try {
        const userInfo = await api.getUserInfo(senderID);
        return userInfo[senderID]?.name || `User_${senderID}`;
    } catch (error) {
        return `User_${senderID}`;
    }
}

// --- HÀM ONLOAD ---
module.exports.onLoad = async function() {
    // Đảm bảo các thư mục cần thiết tồn tại
    const paymentDir = path.join(__dirname, 'payment');
    if (!fs.existsSync(paymentDir)) fs.mkdirSync(paymentDir, { recursive: true });
    
    const globalCacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(globalCacheDir)) fs.mkdirSync(globalCacheDir, { recursive: true });

    // Thư mục cache riêng của lệnh boxscrim
    const commandCacheDir = path.join(__dirname, "boxscrim", "cache");
    if (!fs.existsSync(commandCacheDir)) fs.mkdirSync(commandCacheDir, { recursive: true });

    const fontAsset = { url: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf", path: "Prompt-Bold.ttf", family: "Prompt" };
    const fontPath = path.join(commandCacheDir, fontAsset.path);

    if (!fs.existsSync(fontPath)) {
        try {
            const { data } = await axios.get(fontAsset.url, { responseType: 'arraybuffer' });
            fs.writeFileSync(fontPath, data);
        } catch (e) { console.error(`[BOXSCRIM] Lỗi khi tải font: ${e.message}`); }
    }
    
    try { 
        registerFont(fontPath, { family: fontAsset.family }); 
    } catch (e) { 
        console.error(`[BOXSCRIM] Lỗi đăng ký font: ${e.message}`); 
    }
    
    isAssetsReady = true;
};

// --- HÀM RUN ---
module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID } = event;

    // Kiểm tra tính năng giới hạn của box
    try {
        if (fs.existsSync(limitPath)) {
            const limitData = JSON.parse(fs.readFileSync(limitPath, 'utf8'));
            if (limitData[threadID] && limitData[threadID].game === false) {
                return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID);
            }
        }
    } catch (e) {}

    if (!isAssetsReady) return api.sendMessage("⏳ Tài nguyên đang được tải, vui lòng thử lại sau giây lát...", threadID, messageID);

    const input = args.join(" ");
    const usageMessage = `⚠️ Vui lòng nhập đúng định dạng:\n${this.config.usages}\n\nVí dụ:\n${this.config.name} luffy | BOX CUS LTN | PHÒNG THƯỜNG | 5K - 10K - 15K | 13:00 - 15:00 6K | 20:00 - 22:00 8K | MBBANK 5127032006`;

    if (!input) return api.sendMessage(usageMessage, threadID, messageID);

    const parts = input.split("|").map(p => p.trim());
    const theme = parts[0]?.toLowerCase();

    if (theme !== 'luffy' && theme !== 'itachi') return api.sendMessage(`❌ Theme không hợp lệ. Chỉ hỗ trợ 'luffy' hoặc 'itachi'.`, threadID, messageID);
    if (parts.length !== 7) return api.sendMessage(`❌ Nhập thiếu thông tin. Cần 7 mục, phân tách bởi '|'.`, threadID, messageID);

    const [_, title, roomType, subtitle, line1, line2, bankingInfo] = parts;

    try {
        // Kiểm tra lượt xem người dùng có đủ không
        const userTurnsData = readJsonFile(turnsPath, {});
        const currentTurns = userTurnsData[senderID] || 0;

        if (currentTurns <= 0) {
            return api.sendMessage(`🚫 Bạn đã hết lượt sử dụng. Vui lòng nạp thêm lượt để tiếp tục.`, threadID, messageID);
        }

        // Bắt đầu xử lý: Trừ lượt trước để tránh lạm dụng hệ thống
        const success = deductTurns(senderID, 1);
        if (!success) {
            return api.sendMessage(`❌ Số lượt của bạn không đủ. Vui lòng nạp thêm lượt.`, threadID, messageID);
        }

        api.sendMessage(`⏳ Đang xử lý ảnh theme '${theme}', vui lòng chờ giây lát...`, threadID, async (err, info) => {
            try {
                const imageData = { title, roomType, subtitle, line1, line2, bankingInfo };
                let imageBuffer;

                const imageDir = path.join(__dirname, 'boxscrim', 'cache');

                if (theme === 'luffy') {
                    imageData.imagePath = path.join(imageDir, LUFFY_BG_FILENAME);
                    imageBuffer = await createLuffyImage(imageData);
                } else {
                    imageData.imagePath = path.join(imageDir, ITACHI_BG_FILENAME);
                    imageBuffer = await createItachiImage(imageData);
                }
                
                const tempImagePath = path.join(__dirname, 'boxscrim', 'cache', `scrim_temp_${senderID}_${Date.now()}.png`);
                fs.writeFileSync(tempImagePath, imageBuffer);

                // Cập nhật biệt danh với số lượt còn lại mới nhất
                const remainingTurns = readJsonFile(turnsPath, {})[senderID] || 0;
                const senderName = await getUserName(api, senderID);
                const newNickname = `${senderName} | ${remainingTurns} lượt`;
                
                try {
                    await api.changeNickname(newNickname, threadID, senderID);
                } catch (nickErr) {
                    // Bỏ qua nếu bot không có quyền đổi biệt danh
                }

                // Gửi ảnh hoàn tất
                api.sendMessage({
                    body: `🎉 Ảnh scrim của bạn với theme '${theme}' đã được tạo!\n💎 Số lượt còn lại: ${remainingTurns} lượt`,
                    attachment: fs.createReadStream(tempImagePath)
                }, threadID, async () => {
                    fs.unlinkSync(tempImagePath);
                    
                    // Xóa tin nhắn "Đang xử lý ảnh..."
                    if (info && info.messageID) {
                        api.unsendMessage(info.messageID, (unsendErr) => {
                            if (unsendErr && typeof api.deleteMessage === 'function') {
                                api.deleteMessage(info.messageID);
                            }
                        });
                    }
                }, messageID);

            } catch (processErr) {
                console.error("[BOXSCRIM] Lỗi quá trình tạo ảnh:", processErr);
                
                // Trả lại lượt cho user nếu lỗi trong quá trình tạo ảnh
                const refundData = readJsonFile(turnsPath, {});
                refundData[senderID] = (refundData[senderID] || 0) + 1;
                writeJsonFile(turnsPath, refundData);

                api.sendMessage(`❌ Lỗi hệ thống khi tạo ảnh: ${processErr.message}\n🔄 Hệ thống đã hoàn trả lại 1 lượt cho bạn.`, threadID);
            }
        }, messageID);

    } catch (err) {
        console.error("[BOXSCRIM] Lỗi trong hàm run:", err);
        return api.sendMessage(`❌ Đã xảy ra lỗi hệ thống: ${err.message}.`, threadID, messageID);
    }
};
