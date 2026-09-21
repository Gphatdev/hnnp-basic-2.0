/**
 * ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 * GiaPhat devSTUDIO - THE ULTIMATE PROFESSIONAL BOT SYSTEM 👑
 * ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 * Phiên bản: 5.3.0 (Global Enterprise Edition) - PERFECT TAG FIXED
 * Phát triển: GiaPhat dev x Gemini
 * ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 */

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const cron = require('node-cron');

const PATHS = {
    TURNS: path.join(__dirname, 'data', 'Luotdung', 'bank_user_turns.json'),
    VOHAN_USER: path.join(__dirname, 'data', 'Luotdung', 'tinhdiem_vohan.json'),
    VOHAN_BOX: path.join(__dirname, 'data', 'Luotdung', 'vohan_box.json')
};

module.exports.config = {
    name: "luotdung",
    version: "5.3.0",
    hasPermssion: 0,
    credits: "GiaPhat dev x Gemini",
    description: "Hệ thống quản lý lượt sử dụng cao cấp - GiaPhat STUDIO",
    commandCategory: "Game",
    cooldowns: 6
};

function loadData(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.ensureDirSync(path.dirname(filePath));
            fs.writeJsonSync(filePath, {});
            return {};
        }
        return fs.readJsonSync(filePath);
    } catch (e) {
        return {};
    }
}

function saveData(filePath, data) {
    try {
        fs.writeJsonSync(filePath, data, { spaces: 4 });
    } catch (e) {
        console.error("[LƯỢT DÙNG] Lỗi lưu dữ liệu:", e);
    }
}

async function getUserName(api, uid) {
    try {
        const info = await api.getUserInfo(uid);
        return info && info[uid] && info[uid].name ? info[uid].name : "Người dùng Facebook";
    } catch (e) { 
        return "Người dùng Facebook"; 
    }
}

async function updateProfessionalNickname(api, threadID, uid, name, turns, isVohan) {
    try {
        let nickname = "";
        if (isVohan) {
            nickname = `『 ${name} ➻ ( Vô Hạn Lượt ) ✿ 』`;
        } else if (turns > 0) {
            nickname = `『 ${name} ➻ ${turns} Lượt ✿ 』`;
        } else {
            return;
        }
        await api.changeNickname(nickname, threadID, uid);
    } catch (err) {}
}

module.exports.onLoad = function() {
    console.log("=== [ HNNP STUDIO ] HỆ THỐNG ĐANG KHỞI CHẠY (TAG FIXED MODE) ===");
    cron.schedule('0 0 * * *', async () => {
        const api = global.api || (global.client && global.client.api);
        if (!api) return;

        const boxData = loadData(PATHS.VOHAN_BOX);
        const now = moment().tz("Asia/Ho_Chi_Minh");
        for (const tid in boxData) {
            const exp = moment(boxData[tid].expiry);
            if (exp.isAfter(now)) {
                const daysLeft = exp.diff(now, 'days');
                api.sendMessage(`[ 📢 THÔNG BÁO TỰ ĐỘNG ]\n────────────────────\nNhóm đang trong thời hạn Vô Hạn Box.\n• Thời gian còn lại: ${daysLeft} ngày\n• Ngày hết hạn: ${exp.format("DD/MM/YYYY")}\n\nChúc bạn có những trải nghiệm tuyệt vời cùng GiaPhat devSTUDIO!`, tid);
            }
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
};

module.exports.handleEvent = async function({ api, event }) {
    try {
        const PREFIX = (global.config && global.config.PREFIX) ? global.config.PREFIX : "!";
        if (!event.body || !event.body.startsWith(PREFIX)) return;
        
        const { threadID, messageID, senderID } = event;
        const args = event.body.slice(PREFIX.length).trim().split(/ +/g);
        if (args.length === 0) return;
        const cmd = args.shift().toLowerCase();
        
        const VIP_CMDS = ["1qrin", "1tinhdiem", "1tinhdiemlogo", "1lineup", "2lineup", "1boxscrim", "1taologo"];
        if (VIP_CMDS.includes(cmd)) {
            const turnsData = loadData(PATHS.TURNS);
            const vohanData = loadData(PATHS.VOHAN_USER);
            const boxData = loadData(PATHS.VOHAN_BOX);
            const now = moment().tz("Asia/Ho_Chi_Minh");

            let isBoxVohan = false;
            if (boxData[threadID] && moment(boxData[threadID].expiry).isAfter(now)) {
                if (boxData[threadID].scope === 'all') {
                    isBoxVohan = true;
                } else if (boxData[threadID].scope === 'admin') {
                    try {
                        const threadInfo = await api.getThreadInfo(threadID);
                        const adminIDs = threadInfo.adminIDs.map(a => a.id);
                        if (adminIDs.includes(senderID)) isBoxVohan = true;
                    } catch(e) {}
                }
            }

            if ((vohanData[senderID] && moment(vohanData[senderID]).isAfter(now)) || isBoxVohan) return;

            let currentPaidTurns = turnsData[senderID] || 0;

            if (currentPaidTurns <= 0) {
                const name = await getUserName(api, senderID);
                const msg = `[ ⚠️ THÔNG BÁO KHÓA TÍNH NĂNG ]\n────────────────────\nThành viên @${name} đã hết lượt dùng để thực hiện lệnh VIP: [${cmd}].\n\nVui lòng liên hệ Admin GiaPhat dev để gia hạn dịch vụ.`;
                return api.sendMessage({
                    body: msg,
                    mentions: [{ tag: `@${name}`, id: senderID }]
                }, threadID, messageID);
            }

            turnsData[senderID] = currentPaidTurns - 1;
            saveData(PATHS.TURNS, turnsData);
        }
    } catch (err) {
        console.error("[LƯỢT DÙNG] Lỗi handleEvent:", err);
    }
};

module.exports.handleReply = async function({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;
    if (senderID !== handleReply.author) return;
    const choice = parseInt(body || "0");
    if (choice !== 1 && choice !== 2) return api.sendMessage("❌ Lựa chọn không hợp lệ. Vui lòng phản hồi '1' hoặc '2'.", threadID, messageID);

    const boxData = loadData(PATHS.VOHAN_BOX);
    const now = moment().tz("Asia/Ho_Chi_Minh");
    let current = boxData[threadID] && moment(boxData[threadID].expiry).isAfter(now) ? moment(boxData[threadID].expiry) : now;
    const newExpiry = current.add(handleReply.days, 'days').toISOString();

    boxData[threadID] = { expiry: newExpiry, scope: choice === 1 ? 'admin' : 'all' };
    saveData(PATHS.VOHAN_BOX, boxData);
    api.unsendMessage(handleReply.messageID);

    return api.sendMessage(`[ ✅ KÍCH HOẠT VÔ HẠN BOX THÀNH CÔNG ]\n────────────────────\n• Thời gian cộng: +${handleReply.days} ngày\n• Hạn sử dụng: ${moment(newExpiry).format("HH:mm:ss - DD/MM/YYYY")}\n• Phạm vi áp dụng: ${choice === 1 ? "Quản trị viên" : "Toàn bộ thành viên"}`, threadID);
};

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID, mentions, type, messageReply } = event;
    const isAdmin = global.config.ADMINBOT.includes(senderID) || global.config.ADMINBOT.includes(senderID.toString());
    const sub = args[0] ? args[0].toLowerCase() : "";

    const turnsData = loadData(PATHS.TURNS);
    const vohanData = loadData(PATHS.VOHAN_USER);
    const boxData = loadData(PATHS.VOHAN_BOX);
    const now = moment().tz("Asia/Ho_Chi_Minh");

    const hasMentions = mentions && Object.keys(mentions).length > 0;
    const mentionID = hasMentions ? Object.keys(mentions)[0] : null;

    switch(sub) {
        case 'check': {
            let targetID = (type === "message_reply" && messageReply) ? messageReply.senderID : (mentionID || senderID);
            const name = await getUserName(api, targetID);
            
            const isVohan = vohanData[targetID] && moment(vohanData[targetID]).isAfter(now);
            const turns = turnsData[targetID] || 0;

            let msg = `[ 🔎 HỆ THỐNG KIỂM TRA TÀI KHOẢN ]\n────────────────────\n• Người dùng: @${name}\n`;
            let hasData = false;

            if (turns > 0) {
                msg += `• Số lượt khả dụng: ${turns} lượt\n`;
                hasData = true;
            }

            if (isVohan) {
                const daysLeft = moment(vohanData[targetID]).diff(now, 'days');
                msg += `• Quyền hạn: Vô Hạn Lượt (VIP)\n• Thời gian còn lại: ${daysLeft > 0 ? daysLeft : 0} ngày\n• Ngày hết hạn: ${moment(vohanData[targetID]).format("DD/MM/YYYY")}\n`;
                hasData = true;
            }

            await updateProfessionalNickname(api, threadID, targetID, name, turns, isVohan);

            if (!hasData) {
                msg += `• Trạng thái: Chưa có lượt sử dụng.\n\nLiên hệ Admin GiaPhat dev để đăng ký gói lượt sử dụng!`;
            }

            return api.sendMessage({
                body: msg.trim(),
                mentions: [{ tag: `@${name}`, id: targetID }]
            }, threadID, messageID);
        }

        case 'thanhtoan': {
            if (!isAdmin) return api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này.", threadID, messageID);
            let targetID, price;
            
            if (type === "message_reply" && messageReply) {
                targetID = messageReply.senderID;
                price = parseInt(args[1]);
            } else if (hasMentions) {
                targetID = mentionID;
                price = parseInt(args[args.length - 1]);
            } else {
                targetID = args[1];
                price = parseInt(args[2]);
            }

            if (!targetID || isNaN(price)) return api.sendMessage("❌ Cú pháp không đúng: luotdung thanhtoan [UID/Reply/Tag] [Số tiền]", threadID, messageID);
            
            let turnsAdd = Math.floor(price / 250);
            if (turnsAdd <= 0) return api.sendMessage(`❌ Số tiền ${price.toLocaleString()} VNĐ không đủ để nạp (Tối thiểu 250 VNĐ/lượt).`, threadID, messageID);

            turnsData[targetID] = (turnsData[targetID] || 0) + turnsAdd;
            saveData(PATHS.TURNS, turnsData);

            const name = await getUserName(api, targetID);
            const isVH = vohanData[targetID] && moment(vohanData[targetID]).isAfter(now);
            const totalTurns = turnsData[targetID];
            await updateProfessionalNickname(api, threadID, targetID, name, totalTurns, isVH);

            const msg = `[ ✅ THANH TOÁN THÀNH CÔNG ]\n────────────────────\n• Khách hàng: @${name}\n• Số tiền: ${price.toLocaleString()} VNĐ\n• Số lượt cộng: +${turnsAdd} lượt (250đ/lượt)\n• Tổng lượt hiện có: ${totalTurns} lượt\n\nCảm ơn bạn đã tin tưởng dịch vụ của GiaPhat devSTUDIO!`;
            return api.sendMessage({
                body: msg,
                mentions: [{ tag: `@${name}`, id: targetID }]
            }, threadID, messageID);
        }

        case 'vohan': {
            if (!isAdmin) return api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này.", threadID, messageID);
            let target = (type === "message_reply" && messageReply) ? messageReply.senderID : (mentionID || args[1]);
            let days = parseInt(args[args.length - 1]);
            if (!target || isNaN(days)) return api.sendMessage("❌ Cú pháp không đúng: luotdung vohan [Tag/Reply/UID] [Số ngày]", threadID, messageID);

            let current = vohanData[target] && moment(vohanData[target]).isAfter(now) ? moment(vohanData[target]) : now;
            vohanData[target] = current.add(days, 'days').toISOString();
            saveData(PATHS.VOHAN_USER, vohanData);

            const name = await getUserName(api, target);
            const totalTurns = turnsData[target] || 0;
            await updateProfessionalNickname(api, threadID, target, name, totalTurns, true);
            
            return api.sendMessage({
                body: `✅ Đã cộng thêm ${days} ngày Vô Hạn Lượt cho tài khoản @${name}.`,
                mentions: [{ tag: `@${name}`, id: target }]
            }, threadID);
        }

        case 'vohanbox': {
            if (!isAdmin) return api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này.", threadID, messageID);
            let days = parseInt(args[1]);
            if (isNaN(days)) return api.sendMessage("❌ Cú pháp không đúng: luotdung vohanbox [Số ngày]", threadID, messageID);
            
            return api.sendMessage(`[ ⚙️ THIẾT LẬP VÔ HẠN BOX ]\n────────────────────\n1. Chỉ Quản trị viên sử dụng\n2. Tất cả thành viên sử dụng\n\nPhản hồi tin nhắn này với số '1' hoặc '2' để xác nhận cộng ${days} ngày.`, threadID, (e, i) => {
                if (e) return;
                global.client.handleReply.push({ name: module.exports.config.name, messageID: i.messageID, author: senderID, days: days });
            }, messageID);
        }

        case 'del': {
            if (!isAdmin) return api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này.", threadID, messageID);
            const typeDel = args[1] ? args[1].toLowerCase() : "";
            
            if (typeDel === 'vohanbox') {
                const val = parseInt(args[2]);
                if (isNaN(val)) return api.sendMessage("❌ Cú pháp không đúng.", threadID);
                if (!boxData[threadID]) return api.sendMessage("⚠️ Nhóm này hiện chưa được kích hoạt gói Vô Hạn Box.", threadID);
                boxData[threadID].expiry = moment(boxData[threadID].expiry).subtract(val, 'days').toISOString();
                saveData(PATHS.VOHAN_BOX, boxData);
                const remain = moment(boxData[threadID].expiry).diff(now, 'days');
                return api.sendMessage(`✅ Đã khấu trừ ${val} ngày Vô Hạn Box. Thời gian còn lại: ${remain > 0 ? remain : 0} ngày.`, threadID);
            }

            if (typeDel === 'vohan') {
                const val = parseInt(args[2]);
                let target = (type === "message_reply" && messageReply) ? messageReply.senderID : (mentionID || args[3]);
                if (isNaN(val) || !target) return api.sendMessage("❌ Cú pháp không đúng.", threadID);
                if (!vohanData[target]) return api.sendMessage("⚠️ Thành viên này không có gói Vô Hạn cá nhân.", threadID);
                vohanData[target] = moment(vohanData[target]).subtract(val, 'days').toISOString();
                saveData(PATHS.VOHAN_USER, vohanData);
                const name = await getUserName(api, target);
                const remain = moment(vohanData[target]).diff(now, 'days');
                
                return api.sendMessage({
                    body: `✅ Đã khấu trừ ${val} ngày Vô Hạn của thành viên @${name}. Thời gian còn lại: ${remain > 0 ? remain : 0} ngày.`,
                    mentions: [{ tag: `@${name}`, id: target }]
                }, threadID);
            }

            const num = parseInt(args[1]);
            let targetID = (type === "message_reply" && messageReply) ? messageReply.senderID : (mentionID || args[2]);
            if (!isNaN(num) && targetID) {
                let oldTurns = turnsData[targetID] || 0;
                turnsData[targetID] = Math.max(0, oldTurns - num);
                saveData(PATHS.TURNS, turnsData);
                const name = await getUserName(api, targetID);
                const isVH = vohanData[targetID] && moment(vohanData[targetID]).isAfter(now);
                const totalTurns = turnsData[targetID];
                await updateProfessionalNickname(api, threadID, targetID, name, totalTurns, isVH);
                
                return api.sendMessage({
                    body: `[ 🗑️ CẬP NHẬT TRỪ LƯỢT ]\n────────────────────\n• Khách hàng: @${name}\n• Đã trừ: -${num} lượt\n• Số lượt còn lại: ${turnsData[targetID]} lượt`,
                    mentions: [{ tag: `@${name}`, id: targetID }]
                }, threadID);
            }
            return api.sendMessage("❌ Cú pháp không hợp lệ.", threadID);
        }

        case 'chuyenluot': {
            let target = (type === "message_reply" && messageReply) ? messageReply.senderID : mentionID;
            let amount = parseInt(args[args.length - 1]);
            
            if (!target || isNaN(amount) || amount <= 0) return api.sendMessage("❌ Cú pháp không đúng. Vui lòng nhập: luotdung chuyenluot [@Tag/Reply] [Số lượt]", threadID, messageID);
            
            const senderPaidTurns = turnsData[senderID] || 0;
            if (senderPaidTurns < amount) return api.sendMessage("❌ Bạn không đủ số lượt dùng để thực hiện giao dịch này.", threadID, messageID);

            turnsData[senderID] -= amount;
            turnsData[target] = (turnsData[target] || 0) + amount;
            saveData(PATHS.TURNS, turnsData);
            
            const sName = await getUserName(api, senderID);
            const tName = await getUserName(api, target);
            
            const totalSender = turnsData[senderID];
            const totalTarget = turnsData[target];

            await updateProfessionalNickname(api, threadID, senderID, sName, totalSender, vohanData[senderID] && moment(vohanData[senderID]).isAfter(now));
            await updateProfessionalNickname(api, threadID, target, tName, totalTarget, vohanData[target] && moment(vohanData[target]).isAfter(now));
            
            return api.sendMessage({
                body: `✅ Đã chuyển thành công ${amount} lượt dùng cho @${tName}.`,
                mentions: [{ tag: `@${tName}`, id: target }]
            }, threadID, messageID);
        }

        case 'list': {
            let msg = `[ 📋 DANH SÁCH THÀNH VIÊN VIP ]\n────────────────────\n`;
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                let count = 0;
                let mentionsList = [];
                for (let id of threadInfo.participantIDs) {
                    let t = turnsData[id] || 0;
                    let vh = vohanData[id] && moment(vohanData[id]).isAfter(now);
                    if (t > 0 || vh) {
                        count++;
                        const name = await getUserName(api, id);
                        msg += `${count}. @${name} ➻ ${vh ? "💎 Vô Hạn" : `${t} lượt`}\n`;
                        mentionsList.push({ tag: `@${name}`, id: id });
                    }
                }
                if (count === 0) return api.sendMessage("Nhóm hiện chưa có thành viên nào lưu trữ lượt dùng.", threadID);
                return api.sendMessage({ body: msg, mentions: mentionsList }, threadID);
            } catch (err) {
                return api.sendMessage("❌ Lỗi hệ thống: Không thể truy xuất thông tin nhóm.", threadID);
            }
        }

        case 'thongbao': {
            if (boxData[threadID] && moment(boxData[threadID].expiry).isAfter(now)) {
                const exp = moment(boxData[threadID].expiry);
                const days = exp.diff(now, 'days');
                return api.sendMessage(`[ 🏠 QUẢN LÝ VÔ HẠN BOX ]\n────────────────────\n• Trạng thái: Đang hoạt động\n• Thời gian còn lại: ${days} ngày\n• Ngày hết hạn: ${exp.format("DD/MM/YYYY")}`, threadID);
            }
            return;
        }

        default: {
            let h = `✨ [ GiaPhat devSTUDIO - PROFESSIONAL SYSTEM ] ✨\n────────────────────\n`;
            h += `👤 DÀNH CHO THÀNH VIÊN:\n`;
            h += `• luotdung check [@Tag/Reply/Để trống]: Kiểm tra lượt khả dụng\n`;
            h += `• luotdung chuyenluot [@Tag/Reply] [Số lượt]: Chuyển lượt\n`;
            h += `• luotdung list: Danh sách thành viên VIP trong nhóm\n`;
            h += `• luotdung thongbao: Xem thời hạn Vô Hạn Box\n\n`;
            if (isAdmin) {
                h += `👑 DÀNH CHO QUẢN TRỊ VIÊN:\n`;
                h += `• luotdung thanhtoan [@Tag/Reply/UID] [Số tiền]: Nạp lượt (250đ/lượt)\n`;
                h += `• luotdung vohan [@Tag/Reply/UID] [Số ngày]: Cấp quyền Vô Hạn cá nhân\n`;
                h += `• luotdung vohanbox [Số ngày]: Cấp quyền Vô Hạn cho cả nhóm\n`;
                h += `• luotdung del [Số lượt] [@Tag/Reply/UID]: Khấu trừ lượt dùng\n`;
                h += `• luotdung del [vohan/vohanbox] [Số ngày]: Khấu trừ ngày sử dụng\n`;
            }
            h += `────────────────────\nChi tiết xin vui lòng liên hệ Admin HNHann.`;
            return api.sendMessage(h, threadID, messageID);
        }
    }
};