module.exports.config = {
    name: 'listbox',
    version: '1.0.0',
    credits: 'ManhG',
    hasPermssion: 3,
    description: '[Ban/Unban/Remove] List thread bot đã tham gia',
    commandCategory: 'Admin',
    images: [],
    usages: '[số trang/all]',
    cooldowns: 5
};

module.exports.handleReply = async function({ api, event, args, Threads, handleReply }) {
    const { threadID, messageID } = event;
    if (parseInt(event.senderID) !== parseInt(handleReply.author)) return;
    const moment = require("moment-timezone");
    const time = moment.tz("Asia/Ho_Chi_minh").format("HH:MM:ss L");
    var arg = event.body.split(" ");
    //var idgr = handleReply.groupid[arg[1] - 1];
    //var groupName = handleReply.groupName[arg[1] - 1];
    switch (handleReply.type) {
        case "reply":
            {
                if (arg[0] == "ban" || arg[0] == "Ban") {
                    var arrnum = event.body.split(" ");
                    var msg = "";
                    var modules = "[ 𝐌𝐎𝐃𝐄 ] - 𝗧𝗵𝘂̛̣𝗰 𝘁𝗵𝗶 𝗯𝗮𝗻 «\n"
                    var nums = arrnum.map(n => parseInt(n));
                    nums.shift();
                    for (let num of nums) {
                        var idgr = handleReply.groupid[num - 1];
                        var groupName = handleReply.groupName[num - 1];

                        const data = (await Threads.getData(idgr)).data || {};
                        data.banned = true;
                        data.dateAdded = time;
                        var typef = await Threads.setData(idgr, { data });
                        global.data.threadBanned.set(idgr, { dateAdded: data.dateAdded });
                        msg += typef + ' ' + groupName + '\n𝗧𝗜𝗗: ' + idgr + "\n";
                        console.log(modules, msg)
                    }
                    api.sendMessage(`[ 𝗕𝗔𝗡 𝗡𝗛𝗢́𝗠 ]\n${msg}`, threadID, () => api.unsendMessage(handleReply.messageID));
                    break;
                }

                if (arg[0] == "unban" || arg[0] == "Unban" || arg[0] == "ub" || arg[0] == "Ub") {
                    var arrnum = event.body.split(" ");
                    var msg = "";
                    var modules = "[ 𝐌𝐎𝐃𝐄 ] - 𝗧𝗵𝘂̛̣𝗰 𝘁𝗵𝗶 𝘂𝗻𝗯𝗮𝗻\n"
                    var nums = arrnum.map(n => parseInt(n));
                    nums.shift();
                    for (let num of nums) {
                        var idgr = handleReply.groupid[num - 1];
                        var groupName = handleReply.groupName[num - 1];

                        const data = (await Threads.getData(idgr)).data || {};
                        data.banned = false;
                        data.dateAdded = null;
                        var typef = await Threads.setData(idgr, { data });
                        global.data.threadBanned.delete(idgr, 1);
                        msg += typef + ' ' + groupName + '\n𝗧𝗜𝗗: ' + idgr + "\n";
                        console.log(modules, msg)
                    }
                    api.sendMessage(`[ 𝗨𝗡𝗕𝗔𝗡 ]\n${msg}`, threadID, () => api.unsendMessage(handleReply.messageID));
                    break;
                }

                if (arg[0] == "out" || arg[0] == "Out") {
                    var arrnum = event.body.split(" ");
                    var msg = "";
                    var modules = "[ 𝐌𝐎𝐃𝐄 ] - 𝗧𝗵𝘂̛̣𝗰 𝘁𝗵𝗶 𝗢𝘂𝘁\n"
                    var nums = arrnum.map(n => parseInt(n));
                    nums.shift();
                    for (let num of nums) {
                        var idgr = handleReply.groupid[num - 1];
                        var groupName = handleReply.groupName[num - 1];
                        var typef = api.removeUserFromGroup(`${api.getCurrentUserID()}`, idgr);
                        msg += typef + ' ' + groupName + '\n» TID: ' + idgr + "\n";
                        console.log(modules, msg)
                    }
                    api.sendMessage(`[ 𝗟𝗘𝗔𝗩𝗘 𝗧𝗛𝗘 𝗚𝗥𝗢𝗨𝗣 ]\n${msg}`, threadID, () => api.unsendMessage(handleReply.messageID));
                    break;
                }
            }
    }
};
module.exports.run = async function({ api, event, args, permssion }) {
    if (permssion < 3) return api.sendMessage("Bạn không đủ quyền sử dụng lệnh này", event.threadID, event.messageID);
    switch (args[0]) {
        case "all":
            {
                var inbox = await api.getThreadList(100, null, ['INBOX']);
                let list = [...inbox].filter(group => group.isSubscribed && group.isGroup);
                var listthread = [];
                var listbox = [];
                /////////
                for (var groupInfo of list) {
                    //let data = (await api.getThreadInfo(groupInfo.threadID));
                    //const listUserID = event.participantIDs.filter(ID => ID);
                    listthread.push({
                        id: groupInfo.threadID,
                        name: groupInfo.name || "Chưa đặt tên",
                        participants: groupInfo.participants?.length || groupInfo.participantIDs?.length || 0
                    });
                }
                /////////
                var listbox = listthread.sort((a, b) => {
                    if (a.participants > b.participants) return -1;
                    if (a.participants < b.participants) return 1;
                });
                /////////  
                var groupid = [];
                var groupName = [];
                var page = 1;
                page = parseInt(args[0]) || 1;
                page < 1 ? page = 1 : "";
                var limit = 100000;
                var msg = "====『 𝗟𝗜𝗦𝗧 𝗡𝗛𝗢́𝗠 』====\n━━━━━━━━━━━━━━━━━━\n\n";
                var numPage = Math.ceil(listbox.length / limit);

                for (var i = limit * (page - 1); i < limit * (page - 1) + limit; i++) {
                    if (i >= listbox.length) break;
                    let group = listbox[i];
                    msg += `━━━━━━━━━━━━━━━━━━\n${i + 1}. ${group.name}\n💌 𝗧𝗜𝗗: ${group.id}\n👤 𝗦𝗼̂́ 𝘁𝗵𝗮̀𝗻𝗵 𝘃𝗶𝗲̂𝗻: ${group.participants}\n\n`;
                    groupid.push(group.id);
                    groupName.push(group.name);
                }
                msg += `\n𝗧𝗿𝗮𝗻𝗴 ${page}/${numPage}\n𝗗𝘂̀𝗻𝗴 ${global.config.PREFIX}𝗹𝗶𝘀𝘁𝗯𝗼𝘅 + 𝘀𝗼̂́ 𝘁𝗿𝗮𝗻𝗴/𝗮𝗹𝗹\n\n`

                api.sendMessage(msg + "━━━━━━━━━━━━━━━━━━\n→ 𝗥𝗲𝗽𝗹𝘆 𝗢𝘂𝘁 , 𝗕𝗮𝗻 , 𝗨𝗻𝗯𝗮𝗻 + 𝘀𝗼̂́ 𝘁𝗵𝘂̛́ 𝘁𝘂̛̣, \n→ 𝗰𝗼́ 𝘁𝗵𝗲̂̉ 𝗿𝗲𝗽 𝗻𝗵𝗶𝗲̂̀𝘂 𝘀𝗼̂́, 𝗰𝗮́𝗰𝗵 𝗻𝗵𝗮𝘂 𝗯𝗮̆̀𝗻𝗴 𝗱𝗮̂́𝘂 𝗰𝗮́𝗰𝗵 đ𝗲̂̉ 𝗢𝘂𝘁, 𝗕𝗮𝗻, 𝗨𝗻𝗯𝗮𝗻 𝘁𝗵𝗿𝗲𝗮𝗱 đ𝗼́ 🌹", event.threadID, (e, data) =>
                    global.client.handleReply.push({
                        name: this.config.name,
                        author: event.senderID,
                        messageID: data.messageID,
                        groupid,
                        groupName,
                        type: 'reply'
                    })
                )
            }
            break;

        default:
            try {
                var inbox = await api.getThreadList(100, null, ['INBOX']);
                let list = [...inbox].filter(group =>  group.isSubscribed && group.isGroup);
                var listthread = [];
                var listbox = [];
                /////////
                for (var groupInfo of list) {
                    //let data = (await api.getThreadInfo(groupInfo.threadID));
                    //const listUserID = event.participantIDs.filter(ID => ID);
                    listthread.push({
                        id: groupInfo.threadID,
                        name: groupInfo.name || "Chưa đặt tên",
messageCount: groupInfo.messageCount,
                        participants: groupInfo.participants?.length || groupInfo.participantIDs?.length || 0
                    });

                } //for
                var listbox = listthread.sort((a, b) => {
                    if (a.participants > b.participants) return -1;
                    if (a.participants < b.participants) return 1;
                });
                var groupid = [];
                var groupName = [];
                var page = 1;
                page = parseInt(args[0]) || 1;
                page < 1 ? page = 1 : "";
                var limit = 100;
                var msg = "=====『 𝗟𝗜𝗦𝗧 𝗡𝗛𝗢́𝗠 』=====\n\n";
                var numPage = Math.ceil(listbox.length / limit);

                for (var i = limit * (page - 1); i < limit * (page - 1) + limit; i++) {
                    if (i >= listbox.length) break;
                    let group = listbox[i];
                    msg += `━━━━━━━━━━━━━━━━━━\n${i + 1}. ${group.name}\n[🔰] → 𝗧𝗜𝗗: ${group.id}\n[👤] → 𝗦𝗼̂́ 𝘁𝗵𝗮̀𝗻𝗵 𝘃𝗶𝗲̂𝗻: ${group.participants}\n[💬] → 𝗧𝗼̂̉𝗻𝗴 𝘁𝗶𝗻 𝗻𝗵𝗮̆́𝗻: ${group.messageCount}\n`;
                    groupid.push(group.id);
                    groupName.push(group.name);
                }
                msg += `\n→ 𝗧𝗿𝗮𝗻𝗴 ${page}/${numPage}\𝗗𝘂̀𝗻𝗴 ${global.config.PREFIX}𝗹𝗶𝘀𝘁𝗯𝗼𝘅 + 𝘀𝗼̂́ 𝘁𝗿𝗮𝗻𝗴/𝗮𝗹𝗹\n`

                api.sendMessage(msg + "━━━━━━━━━━━━━━━━━━\n→ 𝗥𝗲𝗽𝗹𝘆 𝗢𝘂𝘁 , 𝗕𝗮𝗻 , 𝗨𝗻𝗯𝗮𝗻 + 𝘀𝗼̂́ 𝘁𝗵𝘂̛́ 𝘁𝘂̛̣, \n→ 𝗰𝗼́ 𝘁𝗵𝗲̂̉ 𝗿𝗲𝗽 𝗻𝗵𝗶𝗲̂̀𝘂 𝘀𝗼̂́, 𝗰𝗮́𝗰𝗵 𝗻𝗵𝗮𝘂 𝗯𝗮̆̀𝗻𝗴 𝗱𝗮̂́𝘂 𝗰𝗮́𝗰𝗵 đ𝗲̂̉ 𝗢𝘂𝘁, 𝗕𝗮𝗻, 𝗨𝗻𝗯𝗮𝗻 𝘁𝗵𝗿𝗲𝗮𝗱 đ𝗼́ 🌹", event.threadID, (e, data) =>
                    global.client.handleReply.push({
                        name: this.config.name,
                        author: event.senderID,
                        messageID: data.messageID,
                        groupid,
                        groupName,
                        type: 'reply'
                    })
                )
            } catch (e) {
                return console.log(e)
            }
    }
};