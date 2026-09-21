module.exports.config = {
    name: 'menu',
    version: '1.1.2',
    hasPermssion: 0,
    credits: 'GiaPhat Dev',
    description: 'Xem danh sách nhóm lệnh và thông tin chi tiết lệnh',
    commandCategory: 'Box',
    usages: '[tên lệnh|all]',
    cooldowns: 5,
    images: [],
    envConfig: {
        autoUnsend: {
            status: true,
            timeOut: 60
        }
    }
};

const { autoUnsend = this.config.envConfig.autoUnsend } = global.config == undefined ? {} : global.config.menu == undefined ? {} : global.config.menu;
const { compareTwoStrings, findBestMatch } = require('string-similarity');
const { readFileSync, writeFileSync, existsSync } = require('fs-extra');

module.exports.run = async function ({ api, event, args }) {
    const moment = require("moment-timezone");
    const { sendMessage: send, unsendMessage: un } = api;
    const { threadID: tid, messageID: mid, senderID: sid } = event;
    const cmds = global.client.commands;
    const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss || DD/MM/YYYY");

    if (args.length >= 1) {
        if (typeof cmds.get(args.join(' ')) == 'object') {
            const body = infoCmds(cmds.get(args.join(' ')).config);
            return send(body, tid, mid);
        } else {
            if (args[0] == 'all') {
                const data = cmds.values();
                var txt = '📜 DANH SÁCH TOÀN BỘ LỆNH\n\n',
                    count = 0;
                for (const cmd of data) txt += `${++count}. ${cmd.config.name} ➜ ${cmd.config.description}\n`;
                txt += `\n⏳ Tự động gỡ tin nhắn sau ${autoUnsend.timeOut}s`;
                return send(txt.trim(), tid, (a, b) => autoUnsend.status ? setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID) : '');
            } else {
                const cmdsValue = cmds.values();
                const arrayCmds = [];
                for (const cmd of cmdsValue) arrayCmds.push(cmd.config.name);
                const similarly = findBestMatch(args.join(' '), arrayCmds);
                if (similarly.bestMatch.rating >= 0.3) return send(`💡 Ý bạn là lệnh "${similarly.bestMatch.target}" đúng không?`, tid, mid);
            }
        }
    } else {
        const data = commandsGroup();
        var txt = '📋 DANH SÁCH NHÓM LỆNH\n\n', count = 0;
        for (const { commandCategory, commandsName } of data) txt += `${++count}. ${commandCategory} (${commandsName.length} lệnh)\n`;
        txt += `\n📦 Tổng số lệnh: ${global.client.commands.size} lệnh\n⏰ Thời gian: ${time}\n👉 Reply từ 1 đến ${data.length} để chọn nhóm lệnh\n⏳ Tự động gỡ tin nhắn sau ${autoUnsend.timeOut}s`;
        return send(txt, tid, (a, b) => {
            global.client.handleReply.push({ name: this.config.name, messageID: b.messageID, author: sid, 'case': 'infoGr', data });
            if (autoUnsend.status) setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID);
        }, mid);
    }
};

module.exports.handleReply = async function ({ handleReply: $, api, event }) {
    const { sendMessage: send, unsendMessage: un } = api;
    const { threadID: tid, messageID: mid, senderID: sid, args } = event;

    if (sid != $.author) {
        const msg = `⚠️ Bạn không có quyền tương tác với menu này`;
        return send(msg, tid, mid);
    }

    switch ($.case) {
        case 'infoGr': {
            var data = $.data[(+args[0]) - 1];
            if (data == undefined) {
                const txt = `❎ Số "${args[0]}" không hợp lệ trong danh sách`;
                return send(txt, tid, mid);
            }

            un($.messageID);
            var txt = `📂 NHÓM LỆNH: ${data.commandCategory.toUpperCase()}\n\n`,
                count = 0;
            for (const name of data.commandsName) {
                const cmdInfo = global.client.commands.get(name).config;
                txt += `${++count}. ${name} ➜ ${cmdInfo.description}\n`;
            }
            txt += `\n👉 Reply từ 1 đến ${data.commandsName.length} để xem chi tiết lệnh\n💡 Dùng ${prefix(tid)}help + [tên lệnh] để tra cứu trực tiếp\n⏳ Tự động gỡ tin nhắn sau ${autoUnsend.timeOut}s`;
            return send(txt, tid, (a, b) => {
                global.client.handleReply.push({ name: this.config.name, messageID: b.messageID, author: sid, 'case': 'infoCmds', data: data.commandsName });
                if (autoUnsend.status) setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID);
            });
        }
        case 'infoCmds': {
            var data = global.client.commands.get($.data[(+args[0]) - 1]);
            if (typeof data != 'object') {
                const txt = `⚠️ Số "${args[0]}" không hợp lệ trong danh sách`;
                return send(txt, tid, mid);
            }

            const { config = {} } = data || {};
            un($.messageID);
            const msg = infoCmds(config);
            return send(msg, tid, mid);
        }
        default:
    }
};

function commandsGroup() {
    const array = [],
        cmds = global.client.commands.values();
    for (const cmd of cmds) {
        const { name, commandCategory } = cmd.config;
        const find = array.find(i => i.commandCategory == commandCategory)
        !find ? array.push({ commandCategory, commandsName: [name] }) : find.commandsName.push(name);
    }
    array.sort(sortCompare('commandsName'));
    return array;
}

function infoCmds(a) {
    return `📌 THÔNG TIN LỆNH

📜 Tên lệnh: ${a.name}
🏷️ Phiên bản: ${a.version}
🔐 Quyền hạn: ${premssionTxt(a.hasPermssion)}
👤 Tác giả: ${a.credits}
📝 Mô tả: ${a.description}
📂 Nhóm: ${a.commandCategory}
⚙️ Cách dùng: ${a.usages}
⏳ Thời gian chờ: ${a.cooldowns}s`;
}

function premssionTxt(a) {
    return a == 0 ? 'Thành Viên' : a == 1 ? 'Quản Trị Viên Nhóm' : a == 2 ? 'ADMINBOT' : 'Người Điều Hành Bot';
}

function prefix(a) {
    const tidData = global.data.threadData.get(a) || {};
    return tidData.PREFIX || global.config.PREFIX;
}

function sortCompare(k) {
    return function (a, b) {
        return (a[k].length > b[k].length ? 1 : a[k].length < b[k].length ? -1 : 0) * -1;
    };
}