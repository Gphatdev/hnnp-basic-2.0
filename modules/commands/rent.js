const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const cron = require('node-cron');

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const DATA_DIR = path.join(process.cwd(), 'modules', 'commands', 'cache', 'data_rentbot_pro');
const RENT_DATA_PATH = path.join(DATA_DIR, 'thuebot_pro.json');
const TRACKER_PATH = path.join(DATA_DIR, 'tracker_rent_status.json');
const KEY_DATA_PATH = path.join(DATA_DIR, 'keys_rent_pro.json');
const BRAND_NAME = "HNNP STUDIO";

fs.ensureDirSync(DATA_DIR);

module.exports.config = {
  name: "rent",
  version: "11.3.0",
  hasPermssion: 0,
  credits: "GiaPhat dev & AI",
  description: "Hệ thống quản lý thời gian thuê Bot tự động & Key Thuê Bot",
  commandCategory: "HNNP STUDIO",
  usages: "[add | del | check | info | list | genkey | <mã key>]",
  cooldowns: 5
};

// ================== ĐỌC CẤU HÌNH TỪ config.json ==================
// Trong config.json có thể thêm (không bắt buộc):
//   "OWNER_UID": "61590018796515"
// Nếu không có OWNER_UID thì lấy ID đầu tiên trong ADMINBOT.
function getAdminList() {
  const cfg = global.config || {};
  const list = [
    ...(Array.isArray(cfg.ADMINBOT) ? cfg.ADMINBOT : []),
    ...(Array.isArray(cfg.NDH) ? cfg.NDH : [])
  ];
  if (cfg.OWNER_UID) list.push(cfg.OWNER_UID);
  return list.map(String);
}

function getOwnerUID() {
  const cfg = global.config || {};
  if (cfg.OWNER_UID) return String(cfg.OWNER_UID);
  if (Array.isArray(cfg.ADMINBOT) && cfg.ADMINBOT.length > 0) return String(cfg.ADMINBOT[0]);
  return "";
}

function isAdminUser(uid) {
  return getAdminList().includes(String(uid));
}

// ================== ĐỌC / GHI DỮ LIỆU ==================
const safeReadJSON = () => {
  try { return fs.readJsonSync(RENT_DATA_PATH); }
  catch { return []; }
};
const safeWriteJSON = (data) => fs.writeJsonSync(RENT_DATA_PATH, data, { spaces: 4 });

const safeReadTracker = () => {
  try { return fs.readJsonSync(TRACKER_PATH); }
  catch { return { unrented: {}, expired: {} }; }
};
const safeWriteTracker = (data) => fs.writeJsonSync(TRACKER_PATH, data, { spaces: 4 });

const safeReadKeys = () => {
  try { return fs.readJsonSync(KEY_DATA_PATH); }
  catch { return {}; }
};
const safeWriteKeys = (data) => fs.writeJsonSync(KEY_DATA_PATH, data, { spaces: 4 });

function getDaysLeft(time_end) {
  const now = moment().tz(TIMEZONE).startOf('day');
  const end = moment.tz(time_end, 'DD/MM/YYYY', TIMEZONE).startOf('day');
  return end.diff(now, 'days');
}

function generateNickname(timeEnd) {
  if (!timeEnd) return `${BRAND_NAME} 🇻🇳 ( Chưa Thuê ❌)`;
  const daysLeft = getDaysLeft(timeEnd);
  return daysLeft > 0
    ? `${BRAND_NAME} 🇻🇳 ${timeEnd} ( ${daysLeft} Ngày ⏳)`
    : `${BRAND_NAME} 🇻🇳 ${timeEnd} ( Hết Hạn ❌)`;
}

async function forceChangeNickname(api, tid, nickname) {
  try { await api.changeNickname(nickname, tid, api.getCurrentUserID()); return true; }
  catch (e) { return false; }
}

// --- HÀM XỬ LÝ SỰ KIỆN DỰ PHÒNG (HANDLE EVENT) ---
module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID } = event;
  if (!threadID || !senderID || senderID === api.getCurrentUserID()) return;

  try {
    let rentData = safeReadJSON();
    const rentItem = rentData.find(e => e.t_id === threadID);

    if (isAdminUser(senderID)) return;

    let tracker = safeReadTracker();
    const nowTimestamp = Date.now();
    let isChanged = false;

    if (!rentItem) {
      if (!tracker.unrented[threadID]) {
        tracker.unrented[threadID] = nowTimestamp;
        isChanged = true;
      } else {
        const hoursPassed = (nowTimestamp - tracker.unrented[threadID]) / (1000 * 60 * 60);
        if (hoursPassed >= 6) {
          try {
            await api.sendMessage(`🚨 CẢNH BÁO HỆ THỐNG DỰ PHÒNG\n\nNhóm đã hết 6 tiếng trải nghiệm dùng thử mà chưa được kích hoạt gói dịch vụ.\nBot sẽ tự động rời nhóm ngay bây giờ.`, threadID);
            await new Promise(res => setTimeout(res, 1500));
            await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
          } catch (e) {}
          delete tracker.unrented[threadID];
          isChanged = true;
        }
      }
    } else {
      const daysLeft = getDaysLeft(rentItem.time_end);
      if (daysLeft <= 0) {
        if (!tracker.expired[threadID]) {
          tracker.expired[threadID] = nowTimestamp;
          isChanged = true;
        } else {
          const hoursExpired = (nowTimestamp - tracker.expired[threadID]) / (1000 * 60 * 60);
          if (hoursExpired >= 6) {
            try {
              await api.sendMessage(`🚨 CẢNH BÁO HỆ THỐNG DỰ PHÒNG\n\nĐã vượt quá thời hạn 6 tiếng chờ gia hạn. Bot sẽ tự động rời nhóm để tối ưu tài nguyên!`, threadID);
              await new Promise(res => setTimeout(res, 1500));
              await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
              rentData = rentData.filter(e => e.t_id !== threadID);
              safeWriteJSON(rentData);
            } catch (e) {}
            delete tracker.expired[threadID];
            isChanged = true;
          }
        }
      }
    }
    if (isChanged) safeWriteTracker(tracker);
  } catch (error) {
    console.error("Lỗi tại handleEvent dự phòng: ", error);
  }
};

// --- TỰ ĐỘNG THÔNG BÁO & SET BIỆT DANH ĐỒNG LOẠT LÚC 00:00 ---
cron.schedule('0 0 * * *', async () => {
  const { api } = global;
  if (!api) return;
  const rentData = safeReadJSON();
  for (const item of rentData) {
    try {
      const threadInfo = await api.getThreadInfo(item.t_id);
      const threadName = threadInfo.threadName || "Nhóm chưa đặt tên";
      await forceChangeNickname(api, item.t_id, generateNickname(item.time_end));

      const msg = `☀️ BÁO CÁO NGÀY MỚI\n\n🏘️ Nhóm: ${threadName}\n🆔 ID: ${item.t_id}\n⌛ Thời gian còn lại: ${getDaysLeft(item.time_end)} ngày\n\n✨ Chúc các bạn một ngày mới đầy năng lượng!`;
      api.sendMessage(msg, item.t_id);
      await new Promise(res => setTimeout(res, 1500));
    } catch (e) {}
  }
}, { scheduled: true, timezone: TIMEZONE });

// --- TỰ ĐỘNG QUÉT MỖI 10 PHÚT ---
cron.schedule('*/10 * * * *', async () => {
  const { api } = global;
  if (!api) return;

  let rentData = safeReadJSON();
  const tracker = safeReadTracker();
  const updatedTracker = { unrented: {}, expired: {} };

  const allActiveThreads = (global.data && global.data.allThreadID) || [];
  const nowTimestamp = Date.now();

  for (const tid of allActiveThreads) {
    const rentItem = rentData.find(e => e.t_id === tid);

    if (!rentItem) {
      let firstSeen = tracker.unrented[tid];
      if (!firstSeen) {
        firstSeen = nowTimestamp;
        try {
          await api.sendMessage(`🔔 THÔNG BÁO DỊCH VỤ - ${BRAND_NAME}\n\n⚠️ Nhóm hiện tại chưa đăng ký kích hoạt gói thuê Bot.\n⏱️ Thời gian dùng thử tối đa: 6 tiếng.\n👉 Vui lòng liên hệ Admin hoặc nhập mã Key kích hoạt để tránh việc Bot tự động rời nhóm!`, tid);
        } catch (e) {}
      }
      updatedTracker.unrented[tid] = firstSeen;

      const hoursPassed = (nowTimestamp - firstSeen) / (1000 * 60 * 60);
      if (hoursPassed >= 6) {
        try {
          await api.sendMessage(`❌ HẾT THỜI GIAN TRẢI NGHIỆM\n\nĐã hết 6 tiếng dùng thử mà nhóm vẫn chưa được gia hạn.\nBot xin phép tự động rời nhóm. Cảm ơn các bạn đã trải nghiệm!`, tid);
          await new Promise(res => setTimeout(res, 2000));
          await api.removeUserFromGroup(api.getCurrentUserID(), tid);
        } catch (e) {}
        delete updatedTracker.unrented[tid];
      }
    }
    else {
      const daysLeft = getDaysLeft(rentItem.time_end);
      if (daysLeft <= 0) {
        let expiredTime = tracker.expired[tid];
        if (!expiredTime) {
          expiredTime = nowTimestamp;
          try {
            await api.sendMessage(`⏰ CẢNH BÁO HẾT HẠN DỊCH VỤ\n\n⚠️ Gói dịch vụ của nhóm đã chính thức HẾT HẠN.\n⏱️ Hệ thống dành ra 6 tiếng chờ gia hạn hoặc nhập mã Key mới.\n👉 Quá thời hạn trên, Bot sẽ tự động rút khỏi nhóm!`, tid);
            await forceChangeNickname(api, tid, generateNickname(rentItem.time_end));
          } catch (e) {}
        }
        updatedTracker.expired[tid] = expiredTime;

        const hoursExpired = (nowTimestamp - expiredTime) / (1000 * 60 * 60);
        if (hoursExpired >= 6) {
          try {
            await api.sendMessage(`❌ THỜI GIAN GIA HẠN ĐÃ HẾT\n\nĐã quá 6 tiếng chờ gia hạn. Bot tự động rời nhóm để giải phóng hệ thống. Rất hân hạnh được phục vụ các bạn!`, tid);
            await new Promise(res => setTimeout(res, 2000));
            await api.removeUserFromGroup(api.getCurrentUserID(), tid);

            rentData = rentData.filter(e => e.t_id !== tid);
            safeWriteJSON(rentData);
          } catch (e) {}
          delete updatedTracker.expired[tid];
        }
      }
    }
  }
  safeWriteTracker(updatedTracker);
}, { scheduled: true, timezone: TIMEZONE });

module.exports.run = async function ({ api, event, args }) {
  const { threadID, senderID } = event;
  const isAdmin = isAdminUser(senderID);
  const inputArg = args[0];
  const type = inputArg ? inputArg.toLowerCase() : undefined;

  const adminCommands = ['genkey', 'list', 'check', 'add', 'del'];

  // 1. KÍCH HOẠT KEY (DÀNH CHO MỌI NGƯỜI)
  if (inputArg && !['info', ...adminCommands].includes(type)) {
    const inputKey = inputArg.toUpperCase();
    const keysData = safeReadKeys();

    if (keysData[inputKey]) {
      const daysToAdd = keysData[inputKey];

      delete keysData[inputKey];
      safeWriteKeys(keysData);

      const rentData = safeReadJSON();
      const idx = rentData.findIndex(e => e.t_id === threadID);
      const now = moment().tz(TIMEZONE);

      if (idx !== -1) {
        const end = (getDaysLeft(rentData[idx].time_end) > 0)
          ? moment.tz(rentData[idx].time_end, 'DD/MM/YYYY', TIMEZONE)
          : moment().tz(TIMEZONE);
        end.add(daysToAdd, 'days');
        rentData[idx].time_end = end.format('DD/MM/YYYY');
        rentData[idx].admin_name = `System Key (${inputKey})`;
      } else {
        rentData.push({
          t_id: threadID,
          time_start: now.format('DD/MM/YYYY'),
          time_end: now.clone().add(daysToAdd, 'days').format('DD/MM/YYYY'),
          admin_name: `System Key (${inputKey})`
        });
      }
      safeWriteJSON(rentData);

      const cur = rentData.find(e => e.t_id === threadID);
      await forceChangeNickname(api, threadID, generateNickname(cur.time_end));
      return api.sendMessage(`🎉 KÍCH HOẠT THÀNH CÔNG\n\n🔑 Mã Key: ${inputKey}\n🎁 Đã cộng thành công +${daysToAdd} ngày sử dụng Bot cho nhóm!\n⌛ Hạn dùng mới: ${cur.time_end}`, threadID);
    }
  }

  // 2. TẠO KEY MỚI (CHỈ ADMIN)
  if (type === 'genkey' && isAdmin) {
    const days = parseInt(args[1]);
    if (isNaN(days) || days <= 0) return api.sendMessage("⚠️ Vui lòng nhập số ngày tạo key hợp lệ!", threadID);

    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newKey = `RENT-${randomString}`;

    const keysData = safeReadKeys();
    keysData[newKey] = days;
    safeWriteKeys(keysData);

    return api.sendMessage(`✅ TẠO MÃ KEY THÀNH CÔNG\n\n🔑 Mã Key: ${newKey}\n⏳ Thời hạn: ${days} ngày\n👉 Thành viên chỉ cần gõ cú pháp: rent ${newKey} ngay tại nhóm để kích hoạt!`, threadID);
  }

  if (type === 'info') {
    const rentData = safeReadJSON();
    const item = rentData.find(e => e.t_id === threadID);
    if (!item) return api.sendMessage(`❌ Nhóm này hiện chưa có dữ liệu thuê Bot trên hệ thống.`, threadID);
    const threadInfo = await api.getThreadInfo(threadID);
    return api.sendMessage(`💎 THÔNG TIN THUÊ BOT - ${BRAND_NAME}\n\n🏘️ Nhóm: ${threadInfo.threadName || "Chưa đặt tên"}\n📅 Ngày bắt đầu: ${item.time_start || "Không rõ"}\n⌛ Ngày hết hạn: ${item.time_end}\n⏳ Thời gian còn lại: ${getDaysLeft(item.time_end)} ngày\n👤 Admin phê duyệt: ${item.admin_name || "Không rõ"}`, threadID);
  }

  if (type === 'list' && isAdmin) {
    const rentData = safeReadJSON();
    const allActiveThreads = (global.data && global.data.allThreadID) || [];

    const validRentList = rentData.filter(item => {
      const daysLeft = getDaysLeft(item.time_end);
      const isBotInGroup = allActiveThreads.includes(item.t_id);
      return daysLeft > 0 && isBotInGroup;
    });

    if (validRentList.length === 0) {
      return api.sendMessage("📂 Hiện không có nhóm nào đang thuê Bot hợp lệ trên hệ thống.", threadID);
    }

    api.sendMessage("⚙️ Đang thu thập dữ liệu nhóm...", threadID);
    let msg = `📋 DANH SÁCH NHÓM ĐANG THUÊ BOT\n\n`;
    let count = 1;

    for (const item of validRentList) {
      const daysLeft = getDaysLeft(item.time_end);
      let nameBox = "Nhóm ẩn / Chưa đặt tên";
      try {
        const tInfo = await api.getThreadInfo(item.t_id);
        if (tInfo && tInfo.threadName) nameBox = tInfo.threadName;
      } catch (e) {}

      msg += `${count++}. ${nameBox}\n`;
      msg += `▸ ID Box: ${item.t_id}\n`;
      msg += `▸ Hạn dùng: ${item.time_end} (Còn ${daysLeft} ngày)\n`;
      msg += `▸ Admin duyệt: ${item.admin_name || "Không rõ"}\n\n`;
    }
    return api.sendMessage(msg.trim(), threadID);
  }

  if (type === 'check' && isAdmin) {
    api.sendMessage("⚙️ Đang tiến hành đồng bộ biệt danh danh sách hệ thống...", threadID);
    const rentData = safeReadJSON();
    for (const item of rentData) await forceChangeNickname(api, item.t_id, generateNickname(item.time_end));
    return api.sendMessage(`✅ Đồng bộ biệt danh hoàn tất!`, threadID);
  }

  if ((type === 'add' || type === 'del') && isAdmin) {
    const days = parseInt(args[1]);
    const tid = args[2] || threadID;
    if (isNaN(days)) return api.sendMessage("⚠️ Vui lòng nhập số ngày hợp lệ!", threadID);

    const infoAdminObj = await api.getUserInfo(senderID);
    const nameOfAdmin = infoAdminObj[senderID].name;

    const rentData = safeReadJSON();
    const idx = rentData.findIndex(e => e.t_id === tid);
    const now = moment().tz(TIMEZONE);

    if (idx !== -1) {
      const end = (getDaysLeft(rentData[idx].time_end) > 0)
        ? moment.tz(rentData[idx].time_end, 'DD/MM/YYYY', TIMEZONE)
        : moment().tz(TIMEZONE);
      if (type === 'add') end.add(days, 'days');
      else end.subtract(days, 'days');
      rentData[idx].time_end = end.format('DD/MM/YYYY');
      rentData[idx].admin_name = nameOfAdmin;
    } else {
      rentData.push({
        t_id: tid,
        time_start: now.format('DD/MM/YYYY'),
        time_end: now.clone().add(days, 'days').format('DD/MM/YYYY'),
        admin_name: nameOfAdmin
      });
    }
    safeWriteJSON(rentData);
    const cur = rentData.find(e => e.t_id === tid);
    await forceChangeNickname(api, tid, generateNickname(cur.time_end));
    return api.sendMessage(`✅ CẬP NHẬT THÀNH CÔNG\n\n⌛ Thời hạn mới: ${cur.time_end}\n👤 Người thực hiện: ${nameOfAdmin}`, threadID);
  }

  // 3. KHÔNG KHỚP LỆNH NÀO (hoặc key sai / không đủ quyền) -> HIỆN MENU
  let msg = "";
  if (inputArg && !['info', ...adminCommands].includes(type)) {
    msg += `❌ Mã Key không hợp lệ hoặc đã được sử dụng.\n\n`;
  }
  msg += `📖 QUẢN LÝ THUÊ BOT - ${BRAND_NAME}\n\n`;
  msg += `👉 rent info : Tra cứu hạn dùng Bot của nhóm.\n`;
  msg += `👉 rent [Mã Key] : Kích hoạt ngày bằng mã Key.\n\n`;

  if (isAdmin) {
    msg += `👑 CỦA ADMIN:\n`;
    msg += `👉 rent genkey [số ngày] : Tạo mã Key kích hoạt.\n`;
    msg += `👉 rent list : Xem danh sách nhóm đang thuê.\n`;
    msg += `👉 rent check : Đồng bộ biệt danh tất cả nhóm.\n`;
    msg += `👉 rent add [số ngày] [ID nhóm] : Cộng ngày thuê.\n`;
    msg += `👉 rent del [số ngày] [ID nhóm] : Trừ ngày thuê.\n\n`;
  }

  const owner = getOwnerUID();
  if (owner) msg += `👤 Liên hệ Admin: facebook.com/${owner}`;

  return api.sendMessage(msg.trim(), threadID);
};