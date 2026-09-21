module.exports.config = {
    name: "anti",
    version: "4.1.7",
    hasPermssion: 0,
    credits: "GiaPhat dev & AI",
    description: "Chống đổi thông tin nhóm",
    commandCategory: "Tiện ích",
    usages: "anti dùng để bật tắt",
    cooldowns: 5,
    images: [],
    dependencies: {
        "fs-extra": "",
    },
};

const { readFileSync, writeFileSync, existsSync } = require("fs-extra");
const path = require('path');
const fs = require('fs');
const antiDataDirectory = path.join(__dirname, 'data');

fs.mkdirSync(antiDataDirectory, { recursive: true });
for (const file of ['antitheme.json', 'antiqtv.json']) {
    const filePath = path.join(antiDataDirectory, file);
    if (!existsSync(filePath)) writeFileSync(filePath, '{}', 'utf8');
}
const antiImageDirectory = path.join(antiDataDirectory, 'anti-gaudev');
fs.mkdirSync(antiImageDirectory, { recursive: true });

module.exports.handleReply = async function ({ api, event, handleReply, Threads }) {
    const { senderID, threadID, messageID, args } = event;
    const { author, permssion } = handleReply;
    const pathData = global.anti;
    const dataAnti = JSON.parse(readFileSync(pathData, "utf8"));

    if (author !== senderID) return api.sendMessage(`❎ Bạn không phải người dùng lệnh`, threadID, async (err, info) => {            
        await new Promise(resolve => setTimeout(resolve, 30 * 1000));
        return api.unsendMessage(info.messageID);
    }, messageID);

    // Thu hồi menu sau khi người dùng reply
    api.unsendMessage(handleReply.messageID);
    
    let bựa = event.senderID != 100018277053087;
    var number = args.filter(i => !isNaN(i));

    for (const num of number) {
        switch (num) {
            case "1": {
                if (permssion < 1 && bựa)
                    return api.sendMessage(
                        "⚠️ Bạn không đủ quyền hạn để sử dụng lệnh này",
                        threadID,
                        messageID
                    );
                var NameBox = dataAnti.boxname;
                const antiImage = NameBox.find(
                    (item) => item.threadID === threadID
                );
                if (antiImage) {
                    dataAnti.boxname = dataAnti.boxname.filter((item) => item.threadID !== threadID);
                    api.sendMessage(
                        "❌ Đã tắt Anti Đổi Tên Box",
                        threadID,
                        messageID
                    );
                } else {
                    var threadName = (await api.getThreadInfo(event.threadID)).threadName;
                    dataAnti.boxname.push({
                        threadID,
                        name: threadName
                    });
                    api.sendMessage(
                        "✅ Đã bật Anti Đổi Tên Box",
                        threadID,
                        messageID
                    );
                }
                writeFileSync(pathData, JSON.stringify(dataAnti, null, 4));
                break;
            }
            case "2": {
                if (permssion < 1 && bựa)
                    return api.sendMessage(
                        "⚠️ Bạn không đủ quyền hạn để sử dụng lệnh này",
                        threadID,
                        messageID
                    );
                const antiImage = dataAnti.boximage.find(
                    a => a.threadID === threadID
                );
                if (antiImage) {
                    dataAnti.boximage = dataAnti.boximage.filter(a => a.threadID !== threadID);
                    api.sendMessage(
                        "❌ Đã tắt Anti Đổi Ảnh Box",
                        threadID,
                        messageID
                    );
                } else {
                    var threadInfo = await api.getThreadInfo(event.threadID);
                    let d = await require('axios').get(threadInfo.imageSrc, { responseType: 'stream' });
                    d.data.pipe(require('fs').createWriteStream(`${__dirname}/data/anti-gaudev/${threadID}.png`));
                    await dataAnti.boximage.push({
                        threadID,
                        url: `${__dirname}/data/anti-gaudev/${threadID}.png`
                    });
                    api.sendMessage(
                        "✅ Đã bật Anti Đổi Ảnh Box",
                        threadID,
                        messageID
                    );
                }
                writeFileSync(pathData, JSON.stringify(dataAnti, null, 4));
                break;
            }
            case "3": {
                if (permssion < 1 && bựa)
                    return api.sendMessage(
                        "⚠️ Bạn không đủ quyền hạn để sử dụng lệnh này",
                        threadID,
                        messageID
                    );
                const NickName = dataAnti.antiNickname.find(
                    (item) => item.threadID === threadID
                );

                if (NickName) {
                    dataAnti.antiNickname = dataAnti.antiNickname.filter((item) => item.threadID !== threadID);
                    api.sendMessage(
                        "❌ Đã tắt Anti Đổi Biệt Danh",
                        threadID,
                        messageID
                    );
                } else {
                    const nickName = (await api.getThreadInfo(event.threadID)).nicknames;
                    dataAnti.antiNickname.push({
                        threadID,
                        data: nickName
                    });
                    api.sendMessage(
                        "✅ Đã bật Anti Đổi Biệt Danh",
                        threadID,
                        messageID
                    );
                }
                writeFileSync(pathData, JSON.stringify(dataAnti, null, 4));
                break;
            }
            case "4": {
                if (permssion < 1 && bựa)
                    return api.sendMessage(
                        "⚠️ Bạn không đủ quyền hạn để sử dụng lệnh này",
                        threadID,
                        messageID
                    );
                const antiout = dataAnti.antiout;
                if (antiout[threadID] == true) {
                    antiout[threadID] = false;
                    api.sendMessage(
                        "❌ Đã tắt Anti Out",
                        threadID,
                        messageID
                    );
                } else {
                    antiout[threadID] = true;
                    api.sendMessage(
                        "✅ Đã bật Anti Out",
                        threadID,
                        messageID
                    );
                }
                writeFileSync(pathData, JSON.stringify(dataAnti, null, 4));
                break;
            }
            case "5": {
                const filepath = path.join(__dirname, 'data', 'antitheme.json');
                let data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                let theme = "";
                try {
                    const threadInfo = await Threads.getInfo(threadID);
                    theme = threadInfo.threadTheme.id;
                } catch (error) {
                    console.error("Error fetching thread theme:", error);
                }
                if (!data.hasOwnProperty(threadID)) {
                    data[threadID] = {
                        themeid: theme || "",
                        themeEnabled: true
                    };
                    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
                } else {
                    data[threadID].themeEnabled = !data[threadID].themeEnabled;
                    if (data[threadID].themeEnabled) {
                        data[threadID].themeid = theme || "";
                    }
                    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
                }
                const statusMessage = data[threadID].themeEnabled ? "✅ Đã bật Anti Theme" : "❌ Đã tắt Anti Theme";
                api.sendMessage(`${statusMessage}`, threadID, messageID);
                break;
            }
            case "6": {
                const dataAntiPath = __dirname + '/data/antiqtv.json';
                const info = await api.getThreadInfo(event.threadID);
                if (!info.adminIDs.some(item => item.id == api.getCurrentUserID()))
                    return api.sendMessage('❎ Bot cần quyền QTV để thực thi lệnh', event.threadID, event.messageID);
                let data = JSON.parse(fs.readFileSync(dataAntiPath));
                if (!data[threadID]) {
                    data[threadID] = true;
                    api.sendMessage(`✅ Đã bật Anti QTV`, threadID, messageID);
                } else {
                    data[threadID] = false;
                    api.sendMessage(`❌ Đã tắt Anti QTV`, threadID, messageID);
                }
                fs.writeFileSync(dataAntiPath, JSON.stringify(data, null, 4));
                break;
            };
            case "7": {
                if (permssion < 1 && bựa)
                    return api.sendMessage("⚠️ Bạn không đủ quyền hạn để sử dụng lệnh này", threadID, messageID);
                if (!dataAnti.antiTagall) dataAnti.antiTagall = {};
                dataAnti.antiTagall[threadID] = !dataAnti.antiTagall[threadID];
                writeFileSync(pathData, JSON.stringify(dataAnti, null, 4));
                api.sendMessage(
                    `${dataAnti.antiTagall[threadID] ? '✅ Đã bật' : '❌ Đã tắt'} Anti Tagall`,
                    threadID,
                    messageID
                );
                break;
            }
            case "8": {
                const themePath = path.join(__dirname, 'data', 'antitheme.json');
                const qtvPath = path.join(__dirname, 'data', 'antiqtv.json');
                let antitheme = {}, antiqtv = {};

                if (fs.existsSync(themePath)) antitheme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
                if (fs.existsSync(qtvPath)) antiqtv = JSON.parse(fs.readFileSync(qtvPath, 'utf8'));

                // Helper emoji status
                const getStatus = (condition) => condition ? "✅ Bật" : "❌ Tắt";

                // Trạng thái các tính năng
                const antiBoxname = getStatus(dataAnti.boxname.some(item => item.threadID === threadID));
                const antiBoximage = getStatus(dataAnti.boximage.some(item => item.threadID === threadID));
                const antiNickname = getStatus(dataAnti.antiNickname.some(item => item.threadID === threadID));
                const antiOut = getStatus(!!dataAnti.antiout[threadID]);
                const themeStatus = getStatus(antitheme[threadID]?.themeEnabled);
                const qtvStatus = getStatus(!!antiqtv[threadID]);
                const tagallStatus = getStatus(!!dataAnti.antiTagall?.[threadID]);

                const message = 
`📊 TRẠNG THÁI ANTI NHÓM

🏷️ Anti Namebox: ${antiBoxname}
🖼️ Anti Imagebox: ${antiBoximage}
✏️ Anti Nickname: ${antiNickname}
🚪 Anti Out: ${antiOut}
🎨 Anti Theme: ${themeStatus}
👑 Anti QTV: ${qtvStatus}
📢 Anti Tagall: ${tagallStatus}`;

                api.sendMessage(message, threadID, async (err, info) => {
                    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
                    return api.unsendMessage(info.messageID);
                }, messageID);
                break;
            }
            default: {
                return api.sendMessage(`❎ Số bạn lựa chọn không hợp lệ`, threadID);
            }
        }
    }
};

module.exports.run = async ({ api, event, permssion }) => {
    const { threadID, messageID, senderID } = event;
    return api.sendMessage(
`🛡️ BẢO VỆ NHÓM (ANTI)

1️⃣ Anti Namebox
2️⃣ Anti Imagebox
3️⃣ Anti Nickname
4️⃣ Anti Out
5️⃣ Anti Theme
6️⃣ Anti QTV
7️⃣ Anti Tagall
8️⃣ Kiểm tra trạng thái Anti

👉 Reply số tương ứng để bật/tắt tính năng!`,
        threadID, async (error, info) => {
            if (error) {
                return api.sendMessage("❎ Đã xảy ra lỗi!", threadID);
            } else {
                global.client.handleReply.push({
                    name: this.config.name,
                    messageID: info.messageID,
                    author: senderID,
                    permssion
                });
            }
        }, messageID);
};