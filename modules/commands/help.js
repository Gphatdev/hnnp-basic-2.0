const axios = require('axios');

this.config = {
    name: "help",
    version: "1.1.2",
    hasPermssion: 0,
    credits: "GiaPhat dev & AI",
    description: "Xem danh sách lệnh và thông tin chi tiết",
    commandCategory: "Box",
    usages: "[tên lệnh/all]",
    cooldowns: 5,
    images: [],
};

this.run = async function({ api, event, args }) {
    const { threadID: tid, messageID: mid, senderID: sid } = event;
    var type = !args[0] ? "" : args[0].toLowerCase();
    var msg = "", array = [], i = 0;
    const cmds = global.client.commands;
    const TIDdata = global.data.threadData.get(tid) || {};
    const admin = global.config.ADMINBOT;
    const NameBot = global.config.BOTNAME;
    const version = this.config.version;
    var prefix = TIDdata.PREFIX || global.config.PREFIX;

    if (type == "all") {
        for (const cmd of cmds.values()) {
            msg += `${++i}. ${cmd.config.name}\n👉 Mô tả: ${cmd.config.description}\n\n`;
        }
        return api.sendMessage(msg.trim(), tid, mid);
    }

    if (type) {
        for (const cmd of cmds.values()) {
            array.push(cmd.config.name.toString());
        }
        if (!array.find(n => n == args[0].toLowerCase())) {
            const stringSimilarity = require('string-similarity');
            const commandName = args.shift().toLowerCase() || "";
            var allCommandName = [];
            const commandValues = [...cmds.keys()];
            for (const cmd of commandValues) allCommandName.push(cmd);
            const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
            msg = `❎ Không tìm thấy lệnh '${type}' trong hệ thống!\n💡 Lệnh gần giống nhất: '${checker.bestMatch.target}'`;
            return api.sendMessage(msg, tid, mid);
        }
        const cmd = cmds.get(type).config;
        const img = cmd.images || [];
        let image = [];
        for (let i = 0; i < img.length; i++) {
            const a = img[i];
            const stream = (await axios.get(a, {
                responseType: "stream"
            })).data;
            image.push(stream);
        }
        msg = 
`📖 HƯỚNG DẪN SỬ DỤNG

📜 Lệnh: ${cmd.name}
👤 Tác giả: ${cmd.credits}
🏷️ Phiên bản: ${cmd.version}
🔐 Quyền hạn: ${TextPr(cmd.hasPermssion)}
📝 Mô tả: ${cmd.description}
📂 Nhóm: ${cmd.commandCategory}
⚙️ Cách dùng: ${cmd.usages}
⏳ Thời gian chờ: ${cmd.cooldowns}s`;

        return api.sendMessage({ body: msg, attachment: image }, tid, mid);
    } else {
        CmdCategory();
        array.sort(S("nameModule"));
        for (const cmd of array) {
            msg += `📂 ${cmd.cmdCategory.toUpperCase()} (${cmd.nameModule.length})\n` +
                   `▸ ${cmd.nameModule.join(", ")}\n\n`;
        }
        msg += 
`📊 THÔNG TIN BOT
🤖 Bot: ${NameBot} | 🔰 Ver: ${version}
👑 Admin: Nguyễn Gia Phát (Gphat dev)
👥 Tổng Admin: ${admin.length}
📦 Tổng số lệnh: ${cmds.size}
🔗 FB Admin: ${global.config.FACEBOOK_ADMIN}

👉 Cú pháp:
• ${prefix}help + [tên lệnh] để xem chi tiết
• ${prefix}help + all để xem toàn bộ lệnh`;

        return api.sendMessage(msg, tid, mid);
    }

    function CmdCategory() {
        for (const cmd of cmds.values()) {
            const {
                commandCategory,
                hasPermssion,
                name: nameModule
            } = cmd.config;
            if (!array.find(i => i.cmdCategory == commandCategory)) {
                array.push({
                    cmdCategory: commandCategory,
                    permission: hasPermssion,
                    nameModule: [nameModule]
                });
            } else {
                const find = array.find(i => i.cmdCategory == commandCategory);
                find.nameModule.push(nameModule);
            }
        }
    }
};

function S(k) {
    return function(a, b) {
        let i = 0;
        if (a[k].length > b[k].length) {
            i = 1;
        } else if (a[k].length < b[k].length) {
            i = -1;
        }
        return i * -1;
    };
}

function TextPr(permission) {
    return permission == 0 ? "Thành Viên" : permission == 1 ? "Quản Trị Viên" : permission == 2 ? "Admin Bot" : "Toàn Quyền";
}