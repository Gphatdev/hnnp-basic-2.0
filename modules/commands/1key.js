/**
 * Tên File: key.js
 * Phiên bản: 2.6.2 (HNNP STUDIO Commercial Edition)
 * Bản quyền: HNNP STUDIO
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const fse = require("fs-extra");
const FormData = require("form-data");

// ============================================================================
// CẤU HÌNH HỆ THỐNG
// ============================================================================

const LOGO_DIR = path.join(__dirname, "data", "FREEFIRE", "logokey");
const DATA_DIR = path.join(__dirname, "data");
const KEYS_FILE = path.join(__dirname, "data", "keys.json");
const KEYS_BACKUP_FILE = path.join(__dirname, "data", "keys_backup.json");
const LIMIT_PATH = path.join(__dirname, "..", "commands", "cache", "limit.json");

const REMOVEBG_ENDPOINT = 'http://localhost:3333/api/removebg';

const DEFAULT_KEY_NAME = "gphat";
const DEFAULT_KEY_CONFIG = {
    ct: "HNNP STUDIO",
    ct2: "HNNP",
    idbang: "43",
    logo: "C:\\Users\\Administrator\\Downloads\\nknp-basic\\modules\\commands\\data\\FREEFIRE\\logokey\\HBOTVN.jpg",
    admins: [], 
    ctvs: [],
    isSystemDefault: true,
    description: "Cấu hình mặc định từ HNNP STUDIO."
};

const BANG_THUONG = { 
    1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
    11: "11", 12: "12", 13: "13", 14: "14", 15: "15", 16: "16", 17: "17", 18: "18", 19: "19", 20: "20",
    21: "21", 22: "22", 23: "23", 24: "24", 25: "25", 26: "26", 27: "27", 28: "28", 29: "29", 30: "30",
    31: "31", 32: "32", 33: "33", 34: "34", 35: "35", 36: "36", 37: "37", 38: "38", 39: "39", 40: "40", 41: "41", 42: "42", 43: "43", 44: "44", 45: "45", 46: "46", 47: "47", 48: "48", 49: "49", 50: "50", 51: "51", 52: "52", 53: "53", 54: "54", 55: "55",
    B13: "b13", B31: "b31", B32: "b32", B33: "b33"
};

const DOC_QUYEN = { 
    LG1: "lg1", PHONG1: "phong1", LG3: "lg3", LG4: "lg4", LG5: "lg5",
    LG6: "lg6", LG7: "lg7", LG8: "lg8", LG9: "lg9", LG10: "lg10", LG11: "lg11", GBVH: "gbvh", MTGBVH: "mtgbvh", GBVHTT: "gbvhtt"
};

class SystemLogger {
    static info(message) {
        console.log(`[HNNP STUDIO] ${new Date().toISOString()} - ${message}`);
    }
    static error(message, err) {
        console.error(`[HNNP STUDIO ERROR] ${new Date().toISOString()} - ${message}`);
        if (err) console.error(err);
    }
    static warn(message) {
        console.warn(`[HNNP STUDIO WARN] ${new Date().toISOString()} - ${message}`);
    }
}

class DataManager {
    static initializeDirectories() {
        try {
            if (!fse.existsSync(DATA_DIR)) fse.mkdirSync(DATA_DIR, { recursive: true });
            if (!fse.existsSync(LOGO_DIR)) fse.mkdirSync(LOGO_DIR, { recursive: true });
        } catch (e) {
            SystemLogger.error("Lỗi khởi tạo thư mục", e);
        }
    }

    static loadKeys() {
        this.initializeDirectories();
        let data = {};
        
        try {
            if (fse.existsSync(KEYS_FILE)) {
                data = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
            }
        } catch (e) {
            SystemLogger.error("Lỗi đọc cấu hình, đang khôi phục bản sao lưu...", e);
            if (fse.existsSync(KEYS_BACKUP_FILE)) {
                try {
                    data = JSON.parse(fs.readFileSync(KEYS_BACKUP_FILE, "utf8"));
                } catch (err) {}
            }
        }

        if (!data[DEFAULT_KEY_NAME]) {
            data[DEFAULT_KEY_NAME] = { ...DEFAULT_KEY_CONFIG };
            this.saveKeys(data);
        }

        return data;
    }

    static saveKeys(data) {
        try {
            if (fse.existsSync(KEYS_FILE)) fse.copyFileSync(KEYS_FILE, KEYS_BACKUP_FILE);
            fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 4), "utf8");
        } catch (e) {
            SystemLogger.error("Không thể ghi dữ liệu", e);
        }
    }

    static checkLimit(threadID) {
        try {
            const limitData = fse.readJsonSync(LIMIT_PATH, { throws: false }) || {};
            const threadLimit = limitData[threadID];
            return !(threadLimit && threadLimit.game === false);
        } catch (e) {
            return true;
        }
    }
}

class NetworkUtils {
    static isImageUrl(url) {
        return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
    }

    static async removeBackground(imageUrl) {
        let imageBuffer;
        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(imgRes.data);
        } catch (e) {
            return { buffer: null, success: false };
        }

        try {
            const form = new FormData();
            form.append('image', imageBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' });
            
            const response = await axios.post(REMOVEBG_ENDPOINT, form, {
                headers: { ...form.getHeaders() },
                timeout: 120000 
            });

            const json = response.data;
            if (json.success && json.image_base64) {
                const cleanBase64 = json.image_base64.replace(/^data:image\/\w+;base64,/, '');
                return { buffer: Buffer.from(cleanBase64, 'base64'), success: true, isAI: true };
            }
            return { buffer: imageBuffer, success: true, isAI: false };
        } catch (error) {
            return { buffer: imageBuffer, success: true, isAI: false };
        }
    }

    static async downloadAndSaveImage(url, keyName, retries = 3) {
        if (!fse.existsSync(LOGO_DIR)) fse.mkdirSync(LOGO_DIR, { recursive: true });
        const filePath = path.join(LOGO_DIR, `${keyName}_${Date.now()}.png`);

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { buffer, success, isAI } = await this.removeBackground(url);
                if (!success || !buffer) throw new Error("Lỗi tải ảnh");
                fs.writeFileSync(filePath, buffer);
                return { filePath, isAI };
            } catch (error) {
                if (attempt === retries) throw new Error("Tải ảnh thất bại!");
                await new Promise(res => setTimeout(res, 2000));
            }
        }
    }
}

class Utility {
    static async getUserName(api, uid) {
        try {
            const info = await api.getUserInfo(uid);
            return info[uid]?.name || uid;
        } catch (e) {
            return uid;
        }
    }

    static isAdminBot(id) {
        return (global.config.ADMINBOT || []).includes(id);
    }

    static isAdminOfKey(data, keyName, userID) {
        if (!data[keyName]) return false;
        if (data[keyName].isSystemDefault) return this.isAdminBot(userID); 
        return (data[keyName].admins || []).includes(userID);
    }

    static isCtvOfKey(data, keyName, userID) {
        if (!data[keyName]) return false;
        return (data[keyName].ctvs || []).includes(userID);
    }

    static validateKeyName(keyName) {
        if (!keyName) return { valid: false, msg: "Vui lòng nhập tên Key muốn tạo!" };
        if (keyName.length > 10) return { valid: false, msg: "Tên Key tối đa 10 ký tự!" };

        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2000}-\u{3300}]/gu;
        if (emojiRegex.test(keyName)) {
            return { valid: false, msg: "Tên Key không được chứa Icon/Emoji!" };
        }
        return { valid: true };
    }
}

module.exports.config = {
    name: "key",
    version: "2.6.2",
    hasPermssion: 0,
    credits: "HNNP STUDIO",
    description: "Quản lý và kích hoạt Key cấu hình HNNP STUDIO",
    commandCategory: "game",
    usages: "[tao|edit|info|addctv|addadmin|delete|list]",
    cooldowns: 3
};

module.exports.run = async function ({ api, event, args }) {
    if (!DataManager.checkLimit(event.threadID)) {
        return api.sendMessage("⚠️ Nhóm của bạn chưa được cấp quyền dùng chức năng này.", event.threadID, event.messageID);
    }

    let data = DataManager.loadKeys();
    const senderID = event.senderID.toString();
    const subCommand = (args[0] || "").toLowerCase();
    const params = args.slice(1);
    const modName = module.exports.config.name;

    switch (subCommand) {
        case "tao":
        case "create": {
            const keyName = params[0];
            const validation = Utility.validateKeyName(keyName);
            
            if (!validation.valid) return api.sendMessage(`⚠️ ${validation.msg}`, event.threadID);
            if (data[keyName]) return api.sendMessage("❌ Key này đã tồn tại trên hệ thống!", event.threadID);
            if (keyName.toLowerCase() === DEFAULT_KEY_NAME.toLowerCase()) {
                return api.sendMessage("❌ Không thể tạo Key trùng với Key hệ thống!", event.threadID);
            }

            if (!Utility.isAdminBot(senderID)) {
                const userOwnedKeys = Object.keys(data).filter(k => 
                    !data[k].isSystemDefault && (data[k].admins || []).includes(senderID)
                );

                if (userOwnedKeys.length >= 3) {
                    let alertMsg = "⚠️ Bạn đã sở hữu tối đa 3 Key!\n\n📌 Danh sách Key hiện tại:\n";
                    userOwnedKeys.forEach((k, index) => {
                        alertMsg += `${index + 1}. 🔑 Key: ${k}\n`;
                    });
                    alertMsg += "\n👉 Để tạo thêm, hãy xóa Key cũ: .key delete <tên key>";
                    return api.sendMessage(alertMsg, event.threadID);
                }
            }

            data[keyName] = {
                ct: "HNNP STUDIO",
                ct2: "HNNP",
                idbang: "43", 
                logo: "C:\\Users\\Administrator\\Desktop\\LEGIBOT\\modules\\data\\logo\\default.png",
                admins: [senderID],
                ctvs: [],
                isSystemDefault: false
            };
            
            DataManager.saveKeys(data);

            const menuAutoSetup = `🎉 Tạo thành công Key: ${keyName}\n` +
                                  `👑 Bạn đã trở thành chủ sở hữu Key này.\n\n` +
                                  `⚙️ CẤU HÌNH NHANH:\n` +
                                  `Reply tin nhắn này chọn số tương ứng:\n` +
                                  `1️⃣ Tên Custom hiển thị\n` +
                                  `2️⃣ Tên viết tắt\n` +
                                  `3️⃣ Sửa bảng xếp hạng\n` +
                                  `4️⃣ Thay Logo\n` +
                                  `5️⃣ Cài đặt tất cả các thông số trên`;

            return api.sendMessage(menuAutoSetup, event.threadID, (error, info) => {
                if (error) return;
                global.client.handleReply.push({
                    step: 1,
                    name: modName,
                    messageID: info.messageID,
                    author: senderID,
                    keyName: keyName,
                });
            });
        }

        case "info": {
            let userKeys = Object.entries(data).filter(([k, v]) => {
                if (v.isSystemDefault) return true; 
                return (v.admins || []).includes(senderID) || (v.ctvs || []).includes(senderID);
            });

            if (userKeys.length === 0) {
                return api.sendMessage("❌ Bạn chưa có hoặc chưa được cấp quyền quản lý Key nào.", event.threadID);
            }

            const page = 1;
            const limit = 5; 
            const totalPages = Math.ceil(userKeys.length / limit);
            const sliceKeys = userKeys.slice(0, limit);

            let msg = `📋 DANH SÁCH KEY (Trang 1/${totalPages})\n\n`;
            let index = 0;

            for (const [keyName, val] of sliceKeys) {
                let adminNames = [];
                for (const adminId of (val.admins || [])) adminNames.push(await Utility.getUserName(api, adminId));

                let ctvNames = [];
                for (const ctvId of (val.ctvs || [])) ctvNames.push(await Utility.getUserName(api, ctvId));

                const keyType = val.isSystemDefault ? "[GỐC]" : "[CÁ NHÂN]";

                msg += `${++index}. 🔑 Key: ${keyName} ${keyType}\n` +
                       `  • Custom: ${val.ct || "Chưa có"}\n` +
                       `  • Viết tắt: ${val.ct2 || "Chưa có"}\n` +
                       `  • BXH: ${val.idbang || "Chưa có"}\n` +
                       `  👑 Admin: ${adminNames.length > 0 ? adminNames.join(", ") : "HNNP STUDIO"}\n` +
                       `  👤 CTV: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Trống"}\n\n`;
            }

            msg += `👉 Gõ "page <số>" để chuyển trang.`;

            return api.sendMessage(msg.trim(), event.threadID, (err, info) => {
                if (err) return;
                global.client.handleReply.push({
                    name: modName,
                    step: "page_info",
                    messageID: info.messageID,
                    author: senderID,
                    keys: userKeys
                });
            }, event.messageID);
        }

        case "edit": {
            const keyName = params[0];
            if (!keyName) return api.sendMessage("⚠️ Vui lòng nhập Key cần chỉnh sửa!", event.threadID);
            if (!data[keyName]) return api.sendMessage("❌ Key này không tồn tại!", event.threadID);
            
            if (data[keyName].isSystemDefault && !Utility.isAdminBot(senderID)) {
                return api.sendMessage("⚠️ Đây là Key hệ thống, bạn không thể chỉnh sửa!", event.threadID);
            }

            if (!Utility.isAdminBot(senderID) && !Utility.isAdminOfKey(data, keyName, senderID)) {
                return api.sendMessage("⛔ Quyền truy cập bị từ chối: Bạn không phải Admin Key này!", event.threadID);
            }

            const menu = `⚙️ CHỈNH SỬA KEY: ${keyName}\n\n` +
                         `Reply số tương ứng để chọn tính năng:\n` +
                         `1️⃣ Sửa Tên Custom hiển thị\n` +
                         `2️⃣ Sửa Tên viết tắt\n` +
                         `3️⃣ Sửa Số bảng xếp hạng\n` +
                         `4️⃣ Cập nhật Logo\n` +
                         `5️⃣ Cài đặt lại toàn bộ thông số`;

            return api.sendMessage(menu, event.threadID, (error, info) => {
                global.client.handleReply.push({
                    step: 1,
                    name: modName,
                    messageID: info.messageID,
                    author: senderID,
                    keyName: keyName,
                });
            });
        }

        case "addctv": {
            const keyName = params[0];
            if (!keyName) return api.sendMessage("⚠️ Vui lòng nhập tên Key!", event.threadID);
            if (!data[keyName]) return api.sendMessage("❌ Key không tồn tại!", event.threadID);

            if (data[keyName].isSystemDefault && !Utility.isAdminBot(senderID)) {
                return api.sendMessage("⚠️ Không thể thêm CTV vào Key hệ thống!", event.threadID);
            }

            if (!Utility.isAdminBot(senderID) && !Utility.isAdminOfKey(data, keyName, senderID)) {
                return api.sendMessage("⛔ Bạn không phải chủ Key nên không thể thêm CTV!", event.threadID);
            }

            let targetUid;
            if (event.messageReply) {
                targetUid = event.messageReply.senderID;
            } else if (event.mentions && Object.keys(event.mentions).length > 0) {
                targetUid = Object.keys(event.mentions)[0];
            } else {
                return api.sendMessage("👉 Hãy tag hoặc Reply tin nhắn người muốn thêm làm CTV!", event.threadID);
            }

            targetUid = targetUid.toString().replace(/[^0-9]/g, "");

            if ((data[keyName].ctvs || []).includes(targetUid)) {
                return api.sendMessage("ℹ️ Người này đã là CTV của Key!", event.threadID);
            }
            if ((data[keyName].admins || []).includes(targetUid)) {
                return api.sendMessage("ℹ️ Người này hiện đang giữ quyền Admin Key!", event.threadID);
            }

            if (!data[keyName].ctvs) data[keyName].ctvs = [];
            data[keyName].ctvs.push(targetUid);
            DataManager.saveKeys(data);

            const targetName = await Utility.getUserName(api, targetUid);
            return api.sendMessage(`✅ Đã thêm CTV "${targetName}" cho Key: ${keyName}`, event.threadID);
        }

        case "addadmin": {
            const keyName = params[0];
            if (!keyName) return api.sendMessage("⚠️ Vui lòng nhập tên Key!", event.threadID);
            if (!data[keyName]) return api.sendMessage("❌ Key không tồn tại!", event.threadID);

            if (data[keyName].isSystemDefault) {
                return api.sendMessage("⚠️ Không thể thêm Admin cho Key hệ thống!", event.threadID);
            }

            if (!Utility.isAdminBot(senderID) && !Utility.isAdminOfKey(data, keyName, senderID)) {
                return api.sendMessage("⛔ Bạn không đủ thẩm quyền thêm Admin Key!", event.threadID);
            }

            let targetUid;
            if (event.messageReply) {
                targetUid = event.messageReply.senderID;
            } else if (event.mentions && Object.keys(event.mentions).length > 0) {
                targetUid = Object.keys(event.mentions)[0];
            } else {
                return api.sendMessage("👉 Hãy tag hoặc Reply tin nhắn người muốn thêm làm Admin Key!", event.threadID);
            }
            
            targetUid = targetUid.toString().replace(/[^0-9]/g, "");

            if ((data[keyName].admins || []).includes(targetUid)) {
                return api.sendMessage("ℹ️ Người này đã là Admin Key từ trước!", event.threadID);
            }

            if (!data[keyName].admins) data[keyName].admins = [];
            data[keyName].admins.push(targetUid);

            if (data[keyName].ctvs && data[keyName].ctvs.includes(targetUid)) {
                data[keyName].ctvs = data[keyName].ctvs.filter(id => id !== targetUid);
            }

            DataManager.saveKeys(data);
            const targetName = await Utility.getUserName(api, targetUid);
            return api.sendMessage(`✅ Đã cấp quyền Admin Key "${targetName}" cho Key: ${keyName}`, event.threadID);
        }

        case "list": {
            if (!Utility.isAdminBot(senderID)) {
                return api.sendMessage("⛔ Lệnh này chỉ dành cho Admin Bot!", event.threadID);
            }

            const allKeys = Object.entries(data);
            if (allKeys.length === 0) return api.sendMessage("❌ Dữ liệu kho Key hiện tại đang trống!", event.threadID);

            const limit = 5;
            const totalPages = Math.ceil(allKeys.length / limit);
            const sliceKeys = allKeys.slice(0, limit);

            let msg = `📋 TỔNG KHO KEY HNNP STUDIO (Trang 1/${totalPages})\n\n`;
            let index = 0;

            for (const [keyName, val] of sliceKeys) {
                let adminNames = [];
                for (const adminId of (val.admins || [])) adminNames.push(await Utility.getUserName(api, adminId));

                let ctvNames = [];
                for (const ctvId of (val.ctvs || [])) ctvNames.push(await Utility.getUserName(api, ctvId));

                const keyType = val.isSystemDefault ? "[HỆ THỐNG]" : "[THƯƠNG MẠI]";

                msg += `${++index}. 🔑 Key: ${keyName} ${keyType}\n` +
                       `  • Custom: ${val.ct} | Viết tắt: ${val.ct2}\n` +
                       `  • BXH: ${val.idbang}\n` +
                       `  👑 Admin: ${adminNames.length > 0 ? adminNames.join(", ") : "Chưa có"}\n` +
                       `  👤 CTV: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Trống"}\n\n`;
            }

            msg += `👉 Gõ "page <số>" để chuyển trang.`;

            return api.sendMessage(msg.trim(), event.threadID, (err, info) => {
                if (err) return;
                global.client.handleReply.push({
                    name: modName,
                    step: "page_list",
                    messageID: info.messageID,
                    author: senderID,
                    keys: allKeys
                });
            });
        }

        case "delete": {
            const keyName = params[0];
            if (!keyName) return api.sendMessage("⚠️ Vui lòng nhập Key cần xóa!", event.threadID);
            if (!data[keyName]) return api.sendMessage("❌ Không tìm thấy Key này!", event.threadID);

            if (data[keyName].isSystemDefault) {
                return api.sendMessage("⚠️ Không thể xóa Key hệ thống mặc định!", event.threadID);
            }

            if (!Utility.isAdminBot(senderID) && !Utility.isAdminOfKey(data, keyName, senderID)) {
                return api.sendMessage("⛔ Bạn không có quyền xóa Key này!", event.threadID);
            }

            delete data[keyName];
            DataManager.saveKeys(data);
            return api.sendMessage(`🗑️ Đã xóa thành công Key: ${keyName}`, event.threadID);
        }

        default: {
            const guide = `📖 QUẢN LÝ KEY - HNNP STUDIO\n\n` +
                          `👉 .key tao <tên_key> : Tạo Key mới (Tối đa 10 ký tự)\n` +
                          `👉 .key edit <tên_key> : Chỉnh sửa cấu hình Key\n` +
                          `👉 .key info : Xem danh sách Key của bạn\n` +
                          `👉 .key addctv <tên_key> : Thêm CTV cho Key\n` +
                          `👉 .key addadmin <tên_key> : Thêm Admin cho Key\n` +
                          `👉 .key delete <tên_key> : Xóa Key\n` +
                          `👉 .key list : Danh sách tất cả Key (Dành cho Admin Bot)\n\n` +
                          `💡 Key dùng chung mặc định: "${DEFAULT_KEY_NAME}"`;
            return api.sendMessage(guide, event.threadID);
        }
    }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    if (!DataManager.checkLimit(event.threadID)) return;

    let data = DataManager.loadKeys();
    const senderID = event.senderID.toString();
    const modName = module.exports.config.name;
    const bodyText = (event.body || "").trim();

    if (senderID !== handleReply.author) return;

    if (handleReply.step === "page_info" || handleReply.step === "page_list") {
        const match = bodyText.match(/^page\s+(\d+)$/i);
        if (!match) return;

        const page = parseInt(match[1], 10);
        const limit = 5;
        const keysArray = handleReply.keys;
        const totalPages = Math.ceil(keysArray.length / limit);

        if (page < 1 || page > totalPages) {
            return api.sendMessage(`❌ Trang không hợp lệ! Vui lòng chọn từ trang 1 đến ${totalPages}`, event.threadID);
        }

        const start = (page - 1) * limit;
        const sliceKeys = keysArray.slice(start, start + limit);

        let msg = `📋 DANH SÁCH KEY (Trang ${page}/${totalPages})\n\n`;
        let index = start;

        for (const [keyName, val] of sliceKeys) {
            let adminNames = [];
            for (const adminId of (val.admins || [])) adminNames.push(await Utility.getUserName(api, adminId));

            let ctvNames = [];
            for (const ctvId of (val.ctvs || [])) ctvNames.push(await Utility.getUserName(api, ctvId));

            const keyType = val.isSystemDefault ? "[GỐC]" : "[CÁ NHÂN]";

            msg += `${++index}. 🔑 Key: ${keyName} ${keyType}\n` +
                   `  • Custom: ${val.ct}\n` +
                   `  • Viết tắt: ${val.ct2}\n` +
                   `  • BXH: ${val.idbang}\n` +
                   `  👑 Admin: ${adminNames.length > 0 ? adminNames.join(", ") : "HNNP STUDIO"}\n` +
                   `  👤 CTV: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Trống"}\n\n`;
        }

        msg += `👉 Gõ "page <số>" để chuyển trang.`;

        return api.sendMessage(msg.trim(), event.threadID, (err, info) => {
            if (err) return;
            global.client.handleReply.push({
                name: modName,
                step: handleReply.step,
                messageID: info.messageID,
                author: senderID,
                keys: keysArray
            });
        });
    }

    if (handleReply.name !== "key") return;

    const keyName = handleReply.keyName;
    if (!data[keyName]) {
        return api.sendMessage("❌ Key này hiện không còn tồn tại trên hệ thống!", event.threadID);
    }

    switch (handleReply.step) {
        case 1: {
            if (!["1", "2", "3", "4", "5"].includes(bodyText)) {
                return api.sendMessage("⚠️ Vui lòng Reply số từ 1 đến 5!", event.threadID, (error, info) => {
                    global.client.handleReply.push({ ...handleReply, messageID: info.messageID });
                });
            }

            if (bodyText === "5") {
                api.sendMessage("📝 [1/4] Nhập TÊN CUSTOM HIỂN THỊ mới:", event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 2, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: "all_ct" });
                });
            } else if (bodyText === "4") {
                api.sendMessage("🖼️ Gửi hoặc Reply ảnh Logo mới (hoặc gửi link ảnh .png/.jpg):", event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 2, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: "logo" });
                });
            } else {
                const mapOption = { 
                    "1": { key: "ct", name: "Tên Custom Hiển Thị" }, 
                    "2": { key: "ct2", name: "Tên Viết Tắt" }, 
                    "3": { key: "idbang", name: "Số bảng xếp hạng (1-55 hoặc Đặc Quyền)" } 
                };
                const fieldInfo = mapOption[bodyText];
                api.sendMessage(`📝 Nhập giá trị mới cho [ ${fieldInfo.name} ]:`, event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 2, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: fieldInfo.key });
                });
            }
            break;
        }

        case 2: {
            const subStep = handleReply.subStep;

            if (!bodyText && subStep !== "logo" && subStep !== "all_ct") {
                return api.sendMessage("❌ Nội dung nhập không được để trống!", event.threadID);
            }

            if (subStep === "all_ct") {
                data[keyName].ct = bodyText;
                DataManager.saveKeys(data);
                api.sendMessage("📝 [2/4] Nhập TÊN VIẾT TẮT mới:", event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 3, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: "all_ct2" });
                });
            } 
            else if (subStep === "logo") {
                let imgSource = "";
                if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
                    imgSource = event.messageReply.attachments.find(a => ["photo", "image"].includes(a.type))?.url;
                }
                if (!imgSource && event.attachments && event.attachments.length > 0) {
                    imgSource = event.attachments.find(a => ["photo", "image"].includes(a.type))?.url;
                }
                if (!imgSource && bodyText) {
                    if (!NetworkUtils.isImageUrl(bodyText)) {
                        return api.sendMessage("❌ Link ảnh không hợp lệ! Vui lòng gửi lại ảnh hoặc link chứa đuôi .png, .jpg", event.threadID, (error, info) => {
                            global.client.handleReply.push({ ...handleReply, messageID: info.messageID });
                        });
                    }
                    imgSource = bodyText;
                }

                if (!imgSource) return api.sendMessage("❌ Không tìm thấy ảnh hợp lệ!", event.threadID);

                api.sendMessage("⏳ Đang tự động xử lý tách nền Logo bằng AI, vui lòng chờ...", event.threadID);

                try {
                    const { filePath: savedPath, isAI } = await NetworkUtils.downloadAndSaveImage(imgSource, keyName);
                    data[keyName].logo = savedPath;
                    DataManager.saveKeys(data);
                    
                    const aiStatus = isAI ? "(Đã tách nền AI)" : "(Lỗi AI - Sử dụng ảnh gốc)";

                    return api.sendMessage({
                        body: `🎉 CẬP NHẬT LOGO THÀNH CÔNG\n\n🔑 Key: ${keyName}\n✨ Trạng thái: ${aiStatus}`,
                        attachment: fs.createReadStream(savedPath)
                    }, event.threadID);
                } catch (e) {
                    return api.sendMessage("❌ Lỗi tải ảnh từ hệ thống, vui lòng thử lại với ảnh khác!", event.threadID);
                }
            } 
            else if (subStep === "ct2") {
                data[keyName].ct2 = bodyText;
                DataManager.saveKeys(data);
                return api.sendMessage(`✅ Đã cập nhật Tên viết tắt thành: ${bodyText}`, event.threadID);
            } 
            else if (subStep === "idbang") {
                const finalBang = bodyText.toUpperCase();
                if (!/^[a-zA-Z0-9]+$/.test(finalBang)) {
                    return api.sendMessage("❌ Bảng xếp hạng không được chứa ký tự đặc biệt!", event.threadID);
                }

                if (BANG_THUONG[finalBang]) {
                    data[keyName].idbang = finalBang.toLowerCase();
                } else if (DOC_QUYEN[finalBang]) {
                    if (!Utility.isAdminBot(senderID)) {
                        return api.sendMessage("⛔ Số bảng xếp hạng Đặc Quyền cần có tài khoản Admin Bot thiết lập!", event.threadID);
                    }
                    data[keyName].idbang = finalBang.toLowerCase();
                } else {
                    return api.sendMessage("❌ Số bảng xếp hạng không nằm trong danh sách hỗ trợ!", event.threadID);
                }

                DataManager.saveKeys(data);
                return api.sendMessage(`✅ Đã cập nhật Số bảng xếp hạng thành: ${data[keyName].idbang}`, event.threadID);
            } 
            else if (subStep === "ct") {
                data[keyName].ct = bodyText;
                DataManager.saveKeys(data);
                return api.sendMessage(`✅ Đã cập nhật Tên Custom thành: ${bodyText}`, event.threadID);
            }
            break;
        }

        case 3: {
            if (!bodyText) return api.sendMessage("❌ Nội dung không hợp lệ, vui lòng nhập lại!", event.threadID);
            if (handleReply.subStep === "all_ct2") {
                data[keyName].ct2 = bodyText;
                DataManager.saveKeys(data);
                api.sendMessage("📝 [3/4] Nhập SỐ BẢNG XẾP HẠNG (từ 1 đến 55):", event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 4, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: "all_idbang" });
                });
            }
            break;
        }

        case 4: {
            if (handleReply.subStep === "all_idbang") {
                const finalBang = bodyText.toUpperCase();
                if (!/^[a-zA-Z0-9]+$/.test(finalBang)) return api.sendMessage("❌ Giá trị nhập không hợp lệ!", event.threadID);

                if (BANG_THUONG[finalBang]) {
                    data[keyName].idbang = finalBang.toLowerCase();
                } else if (DOC_QUYEN[finalBang]) {
                    if (!Utility.isAdminBot(senderID)) return api.sendMessage("⛔ Số bảng xếp hạng Đặc Quyền cần Admin Bot kích hoạt!", event.threadID);
                    data[keyName].idbang = finalBang.toLowerCase();
                } else {
                    return api.sendMessage("❌ Số bảng xếp hạng không tồn tại trên hệ thống!", event.threadID);
                }

                DataManager.saveKeys(data);
                api.sendMessage("🖼️ [4/4] Gửi ảnh hoặc link ảnh LOGO nhận diện mới:", event.threadID, (error, info) => {
                    global.client.handleReply.push({ step: 5, name: modName, messageID: info.messageID, author: senderID, keyName, subStep: "all_logo" });
                });
            }
            break;
        }

        case 5: {
            let imgSource = "";
            if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
                imgSource = event.messageReply.attachments.find(a => ["photo", "image"].includes(a.type))?.url;
            }
            if (!imgSource && event.attachments && event.attachments.length > 0) {
                imgSource = event.attachments.find(a => ["photo", "image"].includes(a.type))?.url;
            }
            if (!imgSource && bodyText) {
                if (!NetworkUtils.isImageUrl(bodyText)) {
                    return api.sendMessage("❌ Định dạng link ảnh không hợp lệ!", event.threadID, (error, info) => {
                        global.client.handleReply.push({ ...handleReply, messageID: info.messageID });
                    });
                }
                imgSource = bodyText;
            }

            api.sendMessage("⏳ Đang tiến hành bóc nền Logo AI và hoàn tất thiết lập...", event.threadID);

            try {
                const { filePath: savedPath, isAI } = await NetworkUtils.downloadAndSaveImage(imgSource, keyName);
                data[keyName].logo = savedPath;
                DataManager.saveKeys(data);

                const aiStatus = isAI ? "(Đã bóc nền AI)" : "(Giữ ảnh gốc)";
                
                const resultMsg = `🎉 TẤT CẢ CẤU HÌNH ĐÃ ĐƯỢC CẬP NHẬT!\n\n` +
                                  `🔑 Key: ${keyName}\n` +
                                  `  • Tên Custom: ${data[keyName].ct}\n` +
                                  `  • Tên viết tắt: ${data[keyName].ct2}\n` +
                                  `  • Số BXH: ${data[keyName].idbang}\n` +
                                  `  • Logo: ${aiStatus}`;

                return api.sendMessage({
                    body: resultMsg,
                    attachment: fs.createReadStream(savedPath)
                }, event.threadID);
            } catch (error) {
                return api.sendMessage("⚠️ Đã lưu thông tin cấu hình thành công nhưng tải ảnh Logo thất bại. Hệ thống sẽ giữ nguyên Logo cũ!", event.threadID);
            }
        }
    }
};