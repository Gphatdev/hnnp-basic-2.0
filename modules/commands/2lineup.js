/**
 * @name test (Lineup)
 * @version 1.6.1
 * @description Tạo lineup FreeFire (có trừ lượt, vô hạn, đổi biệt danh, hoàn lượt khi lỗi)
 * @author Dev by HNNP STUDIO - GiaPhat dev 
 */

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage, registerFont } = require("canvas");
const moment = require("moment-timezone");

// --- ĐƯỜNG DẪN DÙNG CHUNG ---
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');
const turnsFilePath = path.join(__dirname, "data", "Luotdung", "bank_user_turns.json");
const vohanFilePath = path.join(__dirname,  "data", "Luotdung", "tinhdiem_vohan.json");
const LAYOUT_ROOT = path.join(__dirname, "data", "FREEFIRE", "Lineup");

// Đảm bảo các file dữ liệu tồn tại
fs.ensureFileSync(turnsFilePath);
fs.ensureFileSync(vohanFilePath);

let cache = {};

const posMap = {
    t: "Tanker",
    s: "Sniper",
    b: "Bomber",
    sp: "Supports",
    r: "Rifler",
    c: "Coach",
};

// ===== API KEYS REMOVE.BG =====
const API_KEYS = [
    "rmUP3RBYe4gD4bRcWhcdW9qA", "n4Eb9UeeGbHChePSH4qc89G", "hb9jo2m6qbumar7rSxKbQS66",
    "6EfECpD8Nb5XzEpat9G6u4DT", "YzxCdF3LeYfks2Z2pcQytPfq", "uZx7Az8ojMn1scSAt3C2ePhd",
    "sgHtK1pBBSrrLrHoYCbzCm5w", "RVDEtoKLNJmznwUzfaHFCRV5", "gjxFfEicdq51h7ogoqWKfTpY",
];
let currentKeyIndex = 0;

// --- HÀM TIỆN ÍCH ---
function readJSONSafe(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeJsonSync(filePath, defaultValue, { spaces: 2 });
            return defaultValue;
        }
        return fs.readJsonSync(filePath);
    } catch (e) {
        return defaultValue;
    }
}

function checkGameLimit(threadID) {
    try {
        const limitData = readJSONSafe(limitPath);
        return limitData[threadID]?.game === false;
    } catch (e) {
        return false;
    }
}

// --- HÀM XỬ LÝ ẢNH ---
function drawText(ctx, text, cfg) {
    if (!text || !cfg) return;
    const weight = cfg.bold ? "bold" : "normal";
    const style = cfg.italic ? "italic" : "normal";
    const fontSize = cfg.size || 32;
    const fontFamily = cfg.font || "Arial";

    ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = cfg.color || "#FFFFFF";
    ctx.textAlign = cfg.align || "left";
    ctx.textBaseline = "top";

    const lines = String(text).split("\n");
    const lineHeight = cfg.lineHeight || fontSize;

    ctx.save();
    if (cfg.rotate) {
        ctx.translate(cfg.x, cfg.y);
        ctx.rotate((cfg.rotate * Math.PI) / 180);
        lines.forEach((line, i) => ctx.fillText(line, 0, i * lineHeight));
    } else {
        lines.forEach((line, i) => ctx.fillText(line, cfg.x, cfg.y + i * lineHeight));
    }
    ctx.restore();
}

function drawImageRotated(ctx, img, x, y, w, h, rotate = 0) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}

async function removeBackground(imageUrl) {
    if (!API_KEYS || API_KEYS.length === 0) throw new Error("Chưa cấu hình API key remove.bg!");
    let lastErr = null;

    for (let i = 0; i < API_KEYS.length; i++) {
        const key = API_KEYS[currentKeyIndex];
        try {
            const response = await axios({
                method: "post",
                url: "https://api.remove.bg/v1.0/removebg",
                data: { image_url: imageUrl, size: "auto" },
                headers: { "X-Api-Key": key },
                responseType: "arraybuffer",
                timeout: 30000,
            });
            currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
            return response.data;
        } catch (err) {
            console.warn(`❌ Key lỗi: ${key} → thử key khác...`);
            lastErr = err;
            currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        }
    }
    throw lastErr || new Error("Tất cả API key remove.bg đều đã hết hạn hoặc lỗi!");
}

async function tryRemoveBgOrNull(imageUrl) {
    try {
        return await removeBackground(imageUrl);
    } catch (e) {
        console.warn("⚠️ Không xoá được nền, dùng ảnh gốc. Lý do:", e?.message || e);
        return null;
    }
}

async function drawLineup(state) {
    const layoutPath = path.join(LAYOUT_ROOT, state.layoutName);
    const cfgPath = path.join(layoutPath, `layout-${state.num}.json`);
    
    let layoutConfig;
    try {
        layoutConfig = fs.readJsonSync(cfgPath);
    } catch (err) {
        throw new Error(`Lỗi đọc file cấu hình: layout-${state.num}.json`);
    }

    let bgCandidates = [];
    const extensions = ['.png', '.jpg', '.jpeg'];

    if (state.useAvatar) {
        extensions.forEach(ext => bgCandidates.push(path.join(layoutPath, `nhanvat-${state.num}${ext}`)));
    }
    extensions.forEach(ext => bgCandidates.push(path.join(layoutPath, `${state.num}${ext}`)));

    const bgPath = bgCandidates.find(p => fs.existsSync(p));
    if (!bgPath) {
        const missingFiles = state.useAvatar 
            ? `nhanvat-${state.num}.png/jpg hoặc ${state.num}.png/jpg`
            : `${state.num}.png/jpg`;
        throw new Error(`Không tìm thấy background phù hợp cho ${state.num} người trong layout "${state.layoutName}".\nVui lòng bổ sung: ${missingFiles}`);
    }

    const bg = await loadImage(bgPath);
    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bg, 0, 0, bg.width, bg.height);

    if (layoutConfig.tengiai) drawText(ctx, state.tengiai, layoutConfig.tengiai);
    if (layoutConfig.tenteam) drawText(ctx, state.team, layoutConfig.tenteam);

    if (state.logo && layoutConfig.logo) {
        try {
            const logoBuf = await tryRemoveBgOrNull(state.logo);
            const logoImg = await loadImage(logoBuf || state.logo);
            drawImageRotated(ctx, logoImg, layoutConfig.logo.x, layoutConfig.logo.y, layoutConfig.logo.w, layoutConfig.logo.h, layoutConfig.logo.rotate || 0);
        } catch (e) { console.error("Lỗi vẽ logo:", e?.message); }
    }

    for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        const conf = layoutConfig.thanhvien?.[i];
        if (!conf) continue;

        if (conf.name) drawText(ctx, player.name, conf.name);
        
        if (conf.pos && player.pos) {
            const fullPos = posMap[player.pos.toLowerCase()] || player.pos || "";
            drawText(ctx, fullPos, conf.pos);
        }

        if (state.logo && conf.logo) {
            try {
                const logoBuf = await tryRemoveBgOrNull(state.logo);
                const logoImg = await loadImage(logoBuf || state.logo);
                drawImageRotated(ctx, logoImg, conf.logo.x, conf.logo.y, conf.logo.w, conf.logo.h, conf.logo.rotate || 0);
            } catch (e) {}
        }

        if (player.avatar && conf.avatar) {
            try {
                const avaBuf = await tryRemoveBgOrNull(player.avatar);
                const avaImg = await loadImage(avaBuf || player.avatar);
                drawImageRotated(ctx, avaImg, conf.avatar.x, conf.avatar.y, conf.avatar.w, conf.avatar.h, conf.avatar.rotate || 0);
            } catch (e) { console.error(`Lỗi avatar thành viên #${i + 1}:`, e?.message); }
        }
    }

    return canvas.toBuffer("image/png");
}

// --- CẤU HÌNH MODULE ---
module.exports.config = {
    name: "lineup", // Có thể đổi lại thành "lineup"
    version: "1.6.1",
    hasPermssion: 0,
    Rent: 2,
    credits: "Dev by HNNP STUDIO - GiaPhat dev",
    description: "Tạo lineup FreeFire (có trừ lượt, vô hạn, đổi biệt danh, hoàn lượt)",
    commandCategory: "game",
    usages: "Sử dụng để tạo ảnh lineup đội",
    cooldowns: 5,
};

module.exports.onLoad = function () {
    const blue = "\x1b[34m"; // Màu xanh dương cho viền
    const white = "\x1b[37m"; // Màu trắng cho chữ
    const reset = "\x1b[0m";  // Đặt lại màu

    // Sử dụng một lệnh console.log duy nhất chứa \n để không bị lệch bởi prefix của logger
    console.log(
        `\n${blue}╔══════════════════════════════════════════════════════╗\n` +
        `${blue}║${white}                 LINEUP ĐÃ KÍCH HOẠT                  ${blue}║\n` +
        `${blue}║${white}  Author: HNNP STUDIO - GiaPhat Dev | Version: 1.5.0  ${blue}║\n` +
        `${blue}╚══════════════════════════════════════════════════════╝${reset}`
    );
};
async function generateAndSendImage(api, event, state) {
    const { threadID, messageID, senderID } = event;

    // Kiểm tra Vô Hạn
    let isVohanUser = false;
    const vohanData = readJSONSafe(vohanFilePath);
    if (vohanData[senderID]) {
        if (moment().isBefore(moment(vohanData[senderID]))) {
            isVohanUser = true;
        } else {
            delete vohanData[senderID];
            fs.writeJsonSync(vohanFilePath, vohanData, { spaces: 2 });
        }
    }

    // Kiểm tra & Trừ lượt TRƯỚC khi làm ảnh
    let currentTurnsData = readJSONSafe(turnsFilePath);
    if (!isVohanUser) {
        if ((currentTurnsData[senderID] || 0) <= 0) {
            delete cache[senderID];
            return api.sendMessage(`🚫 Bạn đã hết lượt sử dụng lệnh này.\nVui lòng nạp thêm lượt để tiếp tục!`, threadID, messageID);
        }
        currentTurnsData[senderID] -= 1;
        fs.writeJsonSync(turnsFilePath, currentTurnsData, { spaces: 2 });
    }

    api.sendMessage("⏳ Đang dựng ảnh Lineup, vui lòng chờ giây lát...", threadID, async (err, info) => {
        const outPath = path.join(__dirname, "cache", `lineup_${senderID}_${Date.now()}.png`);
        try {
            fs.ensureDirSync(path.dirname(outPath));
            
            // Xử lý tạo ảnh
            const buffer = await drawLineup(state);
            fs.writeFileSync(outPath, buffer);

            // Gửi ảnh thành công
            api.sendMessage({
                body: isVohanUser ? "🎉 Ảnh Lineup của bạn đã hoàn thành!\n💎 Trạng thái: Gói Vô Hạn" : `🎉 Ảnh Lineup của bạn đã hoàn thành!\n💎 Số lượt còn lại: ${currentTurnsData[senderID]} lượt`,
                attachment: fs.createReadStream(outPath)
            }, threadID, async (sendErr) => {
                fs.unlinkSync(outPath).catch(() => {});
                
                // Thu hồi tin nhắn đang chờ
                if (info && info.messageID) {
                    api.unsendMessage(info.messageID).catch(() => {});
                }

                if (sendErr) throw sendErr;

                // Đổi biệt danh
                if (!isVohanUser) {
                    try {
                        const userInfo = await api.getUserInfo(senderID);
                        const userName = userInfo[senderID]?.name || "Người dùng";
                        await api.changeNickname(`${userName} | ${currentTurnsData[senderID]} lượt`, threadID, senderID);
                    } catch (nickErr) {}
                }
            }, messageID);

        } catch (e) {
            console.error("[LINEUP] Lỗi dựng ảnh:", e);
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath).catch(() => {});
            
            // Hoàn lại lượt nếu có lỗi
            if (!isVohanUser) {
                let refundData = readJSONSafe(turnsFilePath);
                refundData[senderID] = (refundData[senderID] || 0) + 1;
                fs.writeJsonSync(turnsFilePath, refundData, { spaces: 2 });
            }

            api.sendMessage(`❌ Lỗi khi dựng ảnh lineup: ${e.message}\n🔄 Hệ thống đã hoàn trả lại 1 lượt cho bạn.`, threadID, messageID);
        } finally {
            delete cache[senderID]; // Giải phóng bộ nhớ
        }
    });
}

// --- HÀM MAIN (Khởi chạy lệnh) ---
module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;

    if (checkGameLimit(threadID)) {
        return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID);
    }

    if (!fs.existsSync(LAYOUT_ROOT)) {
        return api.sendMessage("⚠️ Thư mục `data/FREEFIRE/Lineup` không tồn tại. Vui lòng tạo thư mục và thêm layout.", threadID, messageID);
    }

    const layouts = fs.readdirSync(LAYOUT_ROOT).filter(f => fs.statSync(path.join(LAYOUT_ROOT, f)).isDirectory());

    if (layouts.length === 0) {
        return api.sendMessage("⚠️ Không có layout nào trong thư mục `Lineup`.", threadID, messageID);
    }

    let msg = "🤖 HNNP STUDIO LINEUP BOT 🤖\n\nChọn Layout LineUp Bạn Muốn\n━━━━━━━━━━━━━━━━━━━━\n";
    layouts.forEach((name, i) => msg += `${i + 1}. ${name}\n`);
    msg += "━━━━━━━━━━━━━━━━━━━━\n\nReply tin nhắn này bằng số thứ tự để chọn layout.";

    cache[senderID] = { step: "layout" };

    api.sendMessage(msg, threadID, (err, info) => {
        if (err) return;
        global.client.handleReply.push({
            name: module.exports.config.name,
            messageID: info.messageID,
            author: senderID,
            type: "layout",
            layouts,
        });
    }, messageID);
};

// --- HÀM TƯƠNG TÁC (Reply) ---
module.exports.handleReply = async function ({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;

    if (checkGameLimit(threadID) || senderID !== handleReply.author) return;

    const state = cache[senderID];
    if (!state) return;

    const sendStep = (msg, type, extra = {}) => {
        api.sendMessage(msg, threadID, (err, info) => {
            if (err) return;
            global.client.handleReply.push({
                name: module.exports.config.name,
                messageID: info.messageID,
                author: senderID,
                type,
                ...extra,
            });
        }, messageID);
    };

    try {
        switch (handleReply.type) {
            case "layout": {
                const idx = parseInt(body.trim(), 10) - 1;
                const layoutName = handleReply.layouts[idx];
                if (!layoutName) return api.sendMessage("❌ Lựa chọn không hợp lệ. Vui lòng reply lại bằng một số.", threadID, messageID);

                state.layoutName = layoutName;
                const layoutPath = path.join(LAYOUT_ROOT, layoutName);

                const nums = ["4", "5", "6"];
                const available = nums.filter(n => {
                    const hasBg = [".png", ".jpg", ".jpeg"].some(ext => 
                        fs.existsSync(path.join(layoutPath, `${n}${ext}`)) || 
                        fs.existsSync(path.join(layoutPath, `nhanvat-${n}${ext}`))
                    );
                    const hasCfg = fs.existsSync(path.join(layoutPath, `layout-${n}.json`));
                    return hasBg && hasCfg;
                });

                if (available.length === 0) {
                    return api.sendMessage("❌ Layout này không có file background và/hoặc file cấu hình phù hợp (ví dụ: `5.png` và `layout-5.json`).", threadID, messageID);
                }

                let msg = "🔹 Vui lòng chọn số lượng thành viên:\n\n";
                available.forEach(n => msg += `→ ${n} thành viên\n`);
                msg += "\nReply tin nhắn này bằng số lượng bạn muốn.";

                sendStep(msg, "num", { available });
                break;
            }

            case "num": {
                const choice = body.trim();
                if (!handleReply.available.includes(choice)) return api.sendMessage("❌ Số lượng thành viên không hợp lệ.", threadID, messageID);
                
                state.num = choice;
                sendStep("🔹 Vui lòng nhập tên giải đấu:", "tengiai");
                break;
            }

            case "tengiai": {
                state.tengiai = body.trim();
                sendStep("🔹 Vui lòng nhập tên đội của bạn:", "tenteam");
                break;
            }

            case "tenteam": {
                state.team = body.trim();
                sendStep("📷 Bạn có muốn thêm logo cho đội không? (Reply `có` hoặc `không`)", "askLogo");
                break;
            }

            case "askLogo": {
                if (body.toLowerCase().trim() === "có") {
                    sendStep("📷 Vui lòng reply tin nhắn này bằng ảnh logo của đội.", "logo");
                } else {
                    state.logo = null;
                    sendStep("📷 Bạn có muốn thêm avatar cho các thành viên không? (Reply `có` hoặc `không`)", "askAvatar");
                }
                break;
            }

            case "logo": {
                if (!event.attachments || event.attachments.length === 0 || event.attachments[0].type !== 'photo') {
                    return api.sendMessage("❌ Vui lòng reply bằng 1 ảnh logo hợp lệ.", threadID, messageID);
                }
                state.logo = event.attachments[0].url;
                sendStep("📷 Bạn có muốn thêm avatar cho các thành viên không? (Reply `có` hoặc `không`)", "askAvatar");
                break;
            }

            case "askAvatar": {
                state.useAvatar = (body.toLowerCase().trim() === "có");
                state.players = [];
                sendStep(`🔹 Vui lòng nhập tên của thành viên 1:`, "player", { idx: 1 });
                break;
            }

            case "player": {
                const idx = handleReply.idx;
                const name = body.trim();

                if (!name) return api.sendMessage("❌ Tên không được để trống.", threadID, messageID);
                state.players.push({ name, pos: null, avatar: null });

                if (state.useAvatar) {
                    sendStep(`📷 Vui lòng reply ảnh avatar cho '${name}' hoặc nhập "không" để bỏ qua.`, "playerAvatar", { idx });
                } else {
                    if (idx < parseInt(state.num, 10)) {
                        sendStep(`🔹 Vui lòng nhập tên của thành viên ${idx + 1}:`, "player", { idx: idx + 1 });
                    } else {
                        await generateAndSendImage(api, event, state);
                    }
                }
                break;
            }

            case "playerAvatar": {
                const idx = handleReply.idx;
                const sayNo = body.toLowerCase().trim() === "không";

                if (!sayNo && event.attachments?.length > 0 && event.attachments[0].type === 'photo') {
                    state.players[idx - 1].avatar = event.attachments[0].url;
                }

                if (idx < parseInt(state.num, 10)) {
                    sendStep(`🔹 Vui lòng nhập tên của thành viên ${idx + 1}:`, "player", { idx: idx + 1 });
                } else {
                    await generateAndSendImage(api, event, state);
                }
                break;
            }
        }
    } catch (err) {
        console.error(err);
        api.sendMessage("❌ Đã xảy ra lỗi hệ thống: " + (err?.message || err), threadID, messageID);
        delete cache[senderID];
    }
};