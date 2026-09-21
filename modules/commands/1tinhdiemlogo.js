const moment = require("moment-timezone");
const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");

const FFRANK_PATH = path.join(__dirname, "ffrank");
const garenaApi = require(path.join(FFRANK_PATH, "api.js"));
const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dataRoot = path.join(__dirname, "data");
const fontsPath = path.join(dataRoot, "fonts");
const bxhRoot = path.join(dataRoot, "FREEFIRE");
const layoutsRoot = path.join(bxhRoot, "layouts");
const keysPath = path.join(dataRoot, "keys.json");
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');

const turnsFilePath = path.join(__dirname, 'data', 'Luotdung', 'bank_user_turns.json');
const vohanFilePath = path.join(__dirname, 'data', 'Luotdung', 'tinhdiem_vohan.json');
const vohanBoxFilePath = path.join(__dirname, 'data', 'Luotdung', 'vohan_box.json');

fs.ensureDirSync(dataRoot);
fs.ensureDirSync(fontsPath);
fs.ensureDirSync(bxhRoot);
fs.ensureDirSync(layoutsRoot);
fs.ensureFileSync(turnsFilePath);
fs.ensureFileSync(vohanFilePath);
fs.ensureFileSync(vohanBoxFilePath);

fs.readdirSync(fontsPath)
  .filter(f => f.endsWith(".ttf") || f.endsWith(".otf"))
  .forEach(f => {
    const fontFile = path.join(fontsPath, f);
    const fontName = path.basename(f, path.extname(f));
    try {
      registerFont(fontFile, { family: fontName });
      console.log("✅ Loaded font:", fontName);
    }
    catch (err) {
      console.error("❌ Lỗi load font:", f, err.message);
    }
  });

const TIME_SLOTS = {
  1: ["13:00", "15:00"],
  2: ["15:00", "17:00"],
  3: ["18:00", "20:00"],
  4: ["20:00", "21:50"],
  5: ["21:40", "23:00"],
  6: ["23:00", "01:00"],
  7: ["01:00", "03:00"],
  8: ["10:00", "12:00"]
};
const REPLY_NAME = "tinhdiemlogo";

// Hủy tin nhắn an toàn (unsendMessage có thể không trả về Promise)
function safeUnsend(api, msgID) {
  try {
    const p = api.unsendMessage(msgID);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* bỏ qua */ }
}

function parseXoaToken(tokens) {
  if (!Array.isArray(tokens)) return null;
  for (const t of tokens) {
    if (typeof t !== "string") continue;
    const token = t.trim();
    const m = /^xoa\s*([\d,\s]+)$/i.exec(token);
    if (m) {
      return m[1].split(",").map(n => parseInt(n.trim(), 10)).filter(n => Number.isInteger(n) && n >= 1);
    }
  }
  return null;
}

function parseKeyToken(tokens) {
  if (!Array.isArray(tokens)) return null;
  for (const t of tokens) {
    if (typeof t !== "string") continue;
    const token = t.trim();
    if (!token) continue;
    if (/^xoa[\d,\s]+$/i.test(token)) continue;
    if (/^cpr\d+$/i.test(token)) continue;
    if (/^\d{1,2}:\d{2}$/.test(token) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(token) || /^\d{1,2}h(\d{1,2})?$/.test(token)) continue;
    return token;
  }
  return null;
}

function parseCprToken(tokens) {
  for (const t of tokens) {
    const m = /^cpr(\d+)$/i.exec(t);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function formatCustomTime(startMoment) {
  return startMoment.tz(TIME_ZONE).format("DD/MM HH:mm");
}

function ensureKeysConfig() {
  if (!fs.existsSync(keysPath)) {
    fs.writeFileSync(keysPath, JSON.stringify({
      gphat: { ct: "EN HANN", ct2: "gphat", idbang: "lg1", logo: "", admins: [], ctvs: [] },
      scoring: { ct: "SCO RING", ct2: "SCORING", idbang: "lg1", logo: "", admins: [], ctvs: [] }
    }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(keysPath, "utf8"));
  }
  catch (e) {
    throw new Error("keys.json bị lỗi JSON: " + e.message);
  }
}

function getKeyConf(keysConf, key) {
  return keysConf[key] || keysConf["gphat"] || keysConf["scoring"] || null;
}

function hasKeyPermission(keyConf, senderID) {
  const allowAdmins = Array.isArray(keyConf.admins) ? keyConf.admins.map(String) : [];
  const allowCtvs = Array.isArray(keyConf.ctvs) ? keyConf.ctvs.map(String) : [];
  if (!allowAdmins.length && !allowCtvs.length) return true;
  return allowAdmins.includes(String(senderID)) || allowCtvs.includes(String(senderID));
}

async function loadLayoutById(idbang) {
  const id = String(idbang);
  const layoutDir = path.join(layoutsRoot, id);
  const layoutJson = path.join(layoutDir, "layout.json");
  const bgPath = path.join(layoutDir, "background.png");
  if (!fs.existsSync(layoutJson)) throw new Error(`Không tìm thấy layout.json cho layout "${id}"`);
  if (!fs.existsSync(bgPath)) throw new Error(`Không tìm thấy background.png cho layout "${id}"`);
  const layoutConf = JSON.parse(fs.readFileSync(layoutJson, "utf8"));
  const bgImg = await loadImage(bgPath);
  return { layoutDir, layoutConf, bgImg };
}

function applyText(ctx, cfg, text) {
  if (!cfg || typeof text === "undefined" || text === null) return;
  ctx.fillStyle = cfg.color || "#FFF";
  ctx.textAlign = cfg.align || "left";
  ctx.font = `${cfg.bold ? "bold " : ""}${cfg.size || 22}px ${cfg.font || "Arial"}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(text), cfg.x || 0, cfg.y || 0);
}

async function drawLogo(ctx, cfg, logoPath) {
  if (!cfg || !logoPath) return;
  try {
    const logo = await loadImage(logoPath);
    if (cfg.w && cfg.h) ctx.drawImage(logo, cfg.x || 0, cfg.y || 0, cfg.w, cfg.h);
    else ctx.drawImage(logo, cfg.x || 0, cfg.y || 0);
  }
  catch (e) {
    console.warn("⚠️ Không load logo:", logoPath, e.message);
  }
}

function computeStartEndFromToday(slotId) {
  const [s, e] = TIME_SLOTS[slotId];
  if (!s || !e) return null;
  const today = moment().tz(TIME_ZONE);

  const startHour = parseInt(s.split(":")[0], 10);
  if (today.hour() < 10 && startHour >= 18) {
    today.subtract(1, "day");
  }

  const start = moment.tz(`${today.format("DD/MM/YYYY")} ${s}`, "DD/MM/YYYY HH:mm", TIME_ZONE);
  const end = moment.tz(`${today.format("DD/MM/YYYY")} ${e}`, "DD/MM/YYYY HH:mm", TIME_ZONE);

  if (end.isBefore(start)) end.add(1, "day");
  return { start, end };
}

function aggregateTeams(matchDetails, mode = "normal", cprThreshold = 41) {
  const teamStats = new Map();
  let champion = null;
  let finalMatchCount = matchDetails.length;

  for (let i = 0; i < matchDetails.length; i++) {
    const match = matchDetails[i];
    const matchNumber = i + 1;
    const matchKeys = new Map();

    for (const t of match.ranks) {
      let key = null;
      for (const [k, stats] of teamStats.entries()) {
        const overlap = (t.playerAccountIds || []).filter((id) => stats.playerIds.has(id)).length;
        if (overlap >= 2) { key = k; break; }
      }
      if (!key) {
        key = (t.playerAccountIds || []).sort().join(",") || `team_${Date.now()}_${Math.random()}`;
      }
      if (!teamStats.has(key)) {
        teamStats.set(key, {
          playerIds: new Set(),
          totalScore: 0,
          totalKills: 0,
          totalBooyahs: 0,
          BooyahsGame: [],
          isEligible: false,
          accountNames: Array.isArray(t.accountNames) ? t.accountNames.slice() : [],
          teamName: t.teamName || ""
        });
      } else {
        const existing = teamStats.get(key);
        if ((!existing.accountNames || existing.accountNames.length === 0) && Array.isArray(t.accountNames) && t.accountNames.length) {
          existing.accountNames = t.accountNames.slice();
        }
        if (!existing.teamName && t.teamName) existing.teamName = t.teamName;
      }
      matchKeys.set(t, key);
      (t.playerAccountIds || []).forEach((id) => teamStats.get(key).playerIds.add(id));
    }

    if (mode === "cpr") {
      const booyahTeam = match.ranks.find((r) => r.booyah > 0);
      if (booyahTeam) {
        const booyahKey = matchKeys.get(booyahTeam);
        const booyahStats = teamStats.get(booyahKey);
        if (booyahStats && booyahStats.isEligible) {
          champion = { teamKey: booyahKey, matchWon: matchNumber };
          finalMatchCount = matchNumber;
        }
      }
    }

    match.ranks.forEach((t) => {
      const key = matchKeys.get(t);
      const stats = teamStats.get(key);
      if (stats) {
        stats.totalScore += Number(t.score) || 0;
        stats.totalKills += Number(t.kill) || 0;
        stats.totalBooyahs += Number(t.booyah) || 0;
        if (Number(t.booyah) > 0) stats.BooyahsGame.push(matchNumber);
        if (mode === "cpr" && !stats.isEligible && stats.totalScore >= cprThreshold) stats.isEligible = true;
      }
    });

    if (champion) break;
  }

  const finalTeams = Array.from(teamStats.entries()).map(([key, stats]) => {
    let displayName;
    if (stats.teamName && stats.teamName.trim()) displayName = stats.teamName.trim();
    else if (Array.isArray(stats.accountNames) && stats.accountNames.length && String(stats.accountNames[0]).trim()) displayName = String(stats.accountNames[0]).trim();
    else displayName = "Không tên";
    return { teamKey: key, displayName, ...stats, playerIds: Array.from(stats.playerIds) };
  });

  finalTeams.sort((a, b) => {
    if (mode === "cpr" && champion) {
      if (a.teamKey === champion.teamKey) return -1;
      if (b.teamKey === champion.teamKey) return 1;
    }
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.totalBooyahs !== a.totalBooyahs) return b.totalBooyahs - a.totalBooyahs;
    return b.totalKills - a.totalKills;
  });
  finalTeams.forEach((t, i) => { t.Top = i + 1; });

  return { teams: finalTeams, champion, finalMatchCount };
}

function parseFullTimeArgs(args) {
  const accountId = args[0];
  const tail = args.slice(1);
  if (tail.length < 2) throw new Error("Thiếu thông tin start/end thời gian.");

  const isTimeStr = (str) => /^\d{1,2}[:h]\d{1,2}$|^\d{1,2}h$/.test(str);
  const isDateStr = (str) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str);

  let start, end, extraTokens;

  if (tail.length >= 4 && isDateStr(tail[0]) && isTimeStr(tail[1]) && isDateStr(tail[2]) && isTimeStr(tail[3])) {
    const normalizeDateTime = (inputDate, inputTime) => {
      const [d, m, y] = inputDate.split("/").map(s => s.trim());
      if (!d || !m || !y) throw new Error(`Ngày không hợp lệ: "${inputDate}"`);
      const dd = d.length === 1 ? "0" + d : d;
      const mm = m.length === 1 ? "0" + m : m;
      const yyyy = y;
      let hh = null, min = null;
      const timeStr = inputTime.trim();
      if (/^\d{1,2}h\d{1,2}$/.test(timeStr)) {
        [hh, min] = timeStr.split("h").map(n => parseInt(n, 10));
      } else if (/^\d{1,2}h$/.test(timeStr)) {
        hh = parseInt(timeStr.replace("h", ""), 10);
        min = 0;
      } else if (/^\d{1,2}:\d{1,2}$/.test(timeStr)) {
        [hh, min] = timeStr.split(":").map(n => parseInt(n, 10));
      } else {
        throw new Error(`Định dạng giờ không chuẩn: "${inputTime}"`);
      }
      const HH = hh < 10 ? "0" + hh : String(hh);
      const MM = min < 10 ? "0" + min : String(min);
      return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
    };
    const startStr = normalizeDateTime(tail[0], tail[1]);
    const endStr = normalizeDateTime(tail[2], tail[3]);
    start = moment.tz(startStr, "DD/MM/YYYY HH:mm", TIME_ZONE);
    end = moment.tz(endStr, "DD/MM/YYYY HH:mm", TIME_ZONE);
    extraTokens = tail.slice(4);
  }
  else if (tail.length >= 2 && isTimeStr(tail[0]) && isTimeStr(tail[1])) {
    const parseTimeStr = (str) => {
      let hh, min;
      if (str.includes(':')) {
        [hh, min] = str.split(':').map(n => parseInt(n, 10));
      } else if (str.includes('h')) {
        const p = str.split('h');
        hh = parseInt(p[0], 10);
        min = p[1] ? parseInt(p[1], 10) : 0;
      }
      return { hh, min };
    };
    const t1 = parseTimeStr(tail[0]);
    const t2 = parseTimeStr(tail[1]);
    const now = moment().tz(TIME_ZONE);
    const todayStr = now.format("DD/MM/YYYY");
    start = moment.tz(`${todayStr} ${t1.hh}:${t1.min}`, "DD/MM/YYYY H:m", TIME_ZONE);
    end = moment.tz(`${todayStr} ${t2.hh}:${t2.min}`, "DD/MM/YYYY H:m", TIME_ZONE);
    if (end.isSameOrBefore(start)) end.add(1, 'day');
    if (start.isAfter(now)) { start.subtract(1, 'day'); end.subtract(1, 'day'); }
    extraTokens = tail.slice(2);
  }
  else {
    throw new Error("Cú pháp sai.");
  }

  if (!start.isValid() || !end.isValid()) throw new Error("Thời gian không hợp lệ");
  if (start.isSameOrAfter(end)) throw new Error("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");

  const xoaN = parseXoaToken(extraTokens);
  const key = parseKeyToken(extraTokens) || "gphat";
  const cpr = parseCprToken(extraTokens);
  const mode = cpr ? "cpr" : "normal";
  return { accountId, start, end, key, xoaN, mode, cprThreshold: cpr };
}

module.exports.config = {
  name: "tinhdiemlogo",
  aliases: ["tdlg"],
  version: "3.9",
  hasPermssion: 0,
  credits: "gphat dev",
  description: "Tính Điểm Custom Có Logo bằng Hồ sơ datateam",
  commandCategory: "game",
  usages: "[id] [Ngày giờ] hoặc [id] trống để xem Menu",
  cooldowns: 5
};

module.exports.run = async ({ args, api, event }) => {
  const { threadID, messageID, senderID } = event;

  try {
    const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
    const threadLimit = limitData[threadID];
    if (threadLimit && threadLimit.game === false) {
      return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID);
    }
  } catch (e) { /* bỏ qua */ }

  const helpMsg = `📚 HƯỚNG DẪN TÍNH ĐIỂM LOGO\n\n` +
    `1️⃣ Chọn Menu: .tdlg [ID]\n` +
    `2️⃣ Nhập giờ nhanh: .tdlg [ID] [Giờ_BĐ] [Giờ_KT]\n` +
    `3️⃣ Nhập đầy đủ: .tdlg [ID] [Ngày_BĐ] [Giờ_BĐ] [Ngày_KT] [Giờ_KT]\n\n` +
    `💡 Tùy chọn thêm: [key], xoaN, cprN`;

  if (!args.length) {
    return api.sendMessage(`❌ Bạn chưa nhập ID!\n\n${helpMsg}`, threadID, messageID);
  }

  const accountId = args[0];
  if (isNaN(accountId)) {
    return api.sendMessage(`❌ ID không hợp lệ!\n\n${helpMsg}`, threadID, messageID);
  }

  const isCustomTimeArgs = args.length >= 3 && (/^\d{1,2}[:h]\d{1,2}$|^\d{1,2}h$/.test(args[1]) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(args[1]));
  if (isCustomTimeArgs) {
    try {
      const flowArgs = parseFullTimeArgs(args);
      return executeFlow({ ...flowArgs, api, event });
    } catch (err) {
      return api.sendMessage(`❌ Lỗi nhập liệu: ${err.message}\n\n${helpMsg}`, threadID, messageID);
    }
  }

  const tail = args.slice(1);
  const xoaN = parseXoaToken(tail);
  const key = parseKeyToken(tail) || "gphat";
  const cpr = parseCprToken(tail);
  const mode = cpr ? "cpr" : "normal";

  let keysConf = {};
  try { keysConf = ensureKeysConfig(); }
  catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }

  const keyConf = getKeyConf(keysConf, key);
  if (!keyConf) return api.sendMessage(`❌ Không tìm thấy cấu hình cho key mặc định.`, threadID, messageID);
  if (!hasKeyPermission(keyConf, senderID)) {
    return api.sendMessage(`❌ Bạn không có quyền dùng key "${key}".`, threadID, messageID);
  }

  const uInfo = await api.getUserInfo(senderID).catch(() => ({}));
  const senderName = (uInfo && uInfo[senderID] && uInfo[senderID].name) || "Người dùng";

  const menuMsg = `⏳ CHỌN KHUNG GIỜ TÍNH ĐIỂM\n\n` +
    `1️⃣ 13:00 ➟ 15:00\n` +
    `2️⃣ 15:00 ➟ 17:00\n` +
    `3️⃣ 18:00 ➟ 20:00\n` +
    `4️⃣ 20:00 ➟ 21:50\n` +
    `5️⃣ 21:40 ➟ 23:00\n` +
    `6️⃣ 23:00 ➟ 01:00\n` +
    `7️⃣ 01:00 ➟ 03:00\n` +
    `8️⃣ 10:00 ➟ 12:00\n\n` +
    `📌 Reply số tương ứng để chọn.\n` +
    `👤 Yêu cầu: ${senderName}`;

  return api.sendMessage(menuMsg, threadID, (err, info) => {
    if (err) return;
    global.client = global.client || {};
    global.client.handleReply = global.client.handleReply || [];
    global.client.handleReply.push({
      name: REPLY_NAME,
      messageID: info.messageID,
      author: senderID,
      type: "chon_khung_gio",
      data: { accountId, key, xoaN, mode, cprThreshold: cpr }
    });
  }, messageID);
};

module.exports.handleReply = async ({ api, event, handleReply }) => {
  const { threadID, messageID, senderID } = event;
  const body = event.body || "";

  try {
    const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
    const threadLimit = limitData[threadID];
    if (threadLimit && threadLimit.game === false) return;
  } catch (e) { /* bỏ qua */ }

  if (String(senderID) !== String(handleReply.author) || handleReply.name !== REPLY_NAME || handleReply.type !== "chon_khung_gio") return;

  const selected = body.split(",").map(s => s.trim()).filter(s => s !== "");
  const slotIds = selected.map(n => parseInt(n, 10)).filter(n => TIME_SLOTS[n]);
  if (!slotIds.length) return api.sendMessage("❌ Lựa chọn không hợp lệ. Hãy reply số 1-8.", threadID, messageID);

  safeUnsend(api, handleReply.messageID);

  const { accountId, key, xoaN, mode, cprThreshold } = handleReply.data;

  for (const slotId of slotIds) {
    const timeRange = computeStartEndFromToday(slotId);
    if (!timeRange) continue;

    api.sendMessage(`⏳ Đang xử lý khung ${TIME_SLOTS[slotId][0]} - ${TIME_SLOTS[slotId][1]} cho ${timeRange.start.format("DD/MM")}...`, threadID);

    await executeFlow({ api, event, accountId, start: timeRange.start, end: timeRange.end, key, xoaN, mode, cprThreshold });
  }
};

async function executeFlow({ api, event, accountId, start, end, key = "gphat", xoaN = null, mode = "normal", cprThreshold = null }) {
  const { threadID, messageID, senderID } = event;
  let isFreeForUser = false;

  // Gói Vô Hạn theo Box
  try {
    const vohanBoxData = fs.readJsonSync(vohanBoxFilePath, { throws: false }) || {};
    const boxStatus = vohanBoxData[threadID];
    if (boxStatus && boxStatus.expiry && moment().isBefore(moment(boxStatus.expiry))) {
      if (boxStatus.scope === 'all') {
        isFreeForUser = true;
      } else if (boxStatus.scope === 'admin') {
        const threadInfo = await api.getThreadInfo(threadID);
        if (threadInfo.adminIDs.some(admin => admin.id == senderID)) isFreeForUser = true;
      }
    }
  } catch (e) { /* bỏ qua */ }

  // Gói Vô Hạn cá nhân
  if (!isFreeForUser) {
    try {
      const vohanData = fs.readJsonSync(vohanFilePath, { throws: false }) || {};
      if (vohanData[senderID] && moment().isBefore(moment(vohanData[senderID]))) isFreeForUser = true;
    } catch (e) { /* bỏ qua */ }
  }

  // Lượt dùng
  if (!isFreeForUser) {
    try {
      const turnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
      const userTurns = turnsData[senderID] || 0;
      if (userTurns <= 0) return api.sendMessage(`🚫 Bạn đã hết lượt sử dụng lệnh.`, threadID, messageID);
    } catch (e) { /* bỏ qua */ }
  }

  let keysConf = {};
  try { keysConf = ensureKeysConfig(); }
  catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }

  const keyConf = getKeyConf(keysConf, key);
  if (!keyConf) return api.sendMessage("❌ Không tìm thấy cấu hình key mặc định.", threadID, messageID);
  if (!hasKeyPermission(keyConf, senderID)) {
    return api.sendMessage(`❌ Bạn không có quyền dùng key "${key}".`, threadID, messageID);
  }

  let matchIds = [];
  try {
    matchIds = await garenaApi.findMatches(accountId, start, end);
  } catch (e) {
    return api.sendMessage("ID Đã Hết Lượt Tính Hoặc Lỗi Garena", threadID, messageID);
  }
  if (!matchIds || !matchIds.length) return api.sendMessage("❌ ID Chưa Tham Gia Trận Đấu Nào!", threadID, messageID);

  let matchDetails = [];
  try {
    matchDetails = await garenaApi.getMatchDetails(matchIds);
  } catch (e) {
    return api.sendMessage("ID Đã Hết Lượt Tính Hoặc Lỗi Garena", threadID, messageID);
  }

  if (Array.isArray(xoaN) && xoaN.length > 0) {
    const sorted = [...xoaN].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (Number.isInteger(idx) && idx >= 1 && idx <= matchDetails.length) matchDetails.splice(idx - 1, 1);
    }
  }

  const { teams, champion, finalMatchCount } = aggregateTeams(matchDetails, mode, cprThreshold || 41);
  if (!teams.length) return api.sendMessage("⚠️ Không thể trích xuất danh sách đội thi đấu.", threadID, messageID);

  // ====== Đọc hồ sơ datateam để nhận diện tên đội + logo ======
  const userDatateamRoot = path.join(__dirname, "datateam");
  const logoFromKey = keyConf.logo && String(keyConf.logo).trim() ? keyConf.logo : null;
  const idMap = new Map();

  try {
    const folders = fs.readdirSync(userDatateamRoot);
    for (const f of folders) {
      const file = path.join(userDatateamRoot, f, "datateam.json");
      if (!fs.existsSync(file)) continue;
      const data = fs.readJsonSync(file, { throws: false }) || {};
      for (const [teamName, arr] of Object.entries(data)) {
        const teamData = Array.isArray(arr) ? arr[0] : null;
        if (teamData && Array.isArray(teamData.accountID)) {
          teamData.accountID.forEach(id => {
            const cleanId = String(id).replace(/\*\*$/, "");
            if (!idMap.has(cleanId)) idMap.set(cleanId, { teamName, logoPath: teamData.logo || null });
          });
        }
      }
    }
  } catch (e) { /* không có thư mục datateam thì bỏ qua */ }

  let teamsWithLogoCount = 0;

  teams.forEach(team => {
    team.displayName = (team.accountNames && team.accountNames.length) ? team.accountNames[0] : "Không tên";
    team.logoPath = null;

    for (const pid of team.playerIds) {
      const unmPid = String(pid).replace(/\*\*$/, "");
      if (idMap.has(unmPid)) {
        const info = idMap.get(unmPid);
        team.displayName = info.teamName;
        team.logoPath = info.logoPath;
        break;
      }
    }

    if (team.logoPath) teamsWithLogoCount++;
    if (!team.logoPath) team.logoPath = logoFromKey;
  });

  const layoutId = String(keyConf.idbang || "lg1");
  const idbangNum = layoutId.replace(/\D/g, '') || layoutId;

  let layoutPack;
  try {
    layoutPack = await loadLayoutById(layoutId);
  } catch (e) {
    return api.sendMessage("❌ " + e.message, threadID, messageID);
  }

  try {
    const { layoutConf, bgImg } = layoutPack;
    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bgImg, 0, 0);
    const customName = keyConf.ct || key;
    const customTime = formatCustomTime(start.clone());

    if (layoutConf.header) {
      if (layoutConf.header.customName) applyText(ctx, layoutConf.header.customName, customName);
      if (layoutConf.header.customTime) applyText(ctx, layoutConf.header.customTime, customTime);
      if (Array.isArray(layoutConf.header.logos)) {
        for (let i = 0; i < Math.min(teams.length, layoutConf.header.logos.length); i++) {
          if (teams[i].logoPath) await drawLogo(ctx, layoutConf.header.logos[i], teams[i].logoPath);
        }
      }
    }

    const maxRow = layoutConf.limit || 10;
    for (let i = 0; i < Math.min(maxRow, teams.length); i++) {
      const team = teams[i];
      const slotCfg = layoutConf[`Top${i + 1}`];
      if (!slotCfg) continue;
      if (slotCfg.Top) applyText(ctx, slotCfg.Top, String(team.Top));
      if (slotCfg.Name) applyText(ctx, slotCfg.Name, team.displayName);
      if (slotCfg.Kill) applyText(ctx, slotCfg.Kill, String(team.totalKills));
      if (slotCfg.Booyah) applyText(ctx, slotCfg.Booyah, String(team.totalBooyahs));
      if (slotCfg.Score) applyText(ctx, slotCfg.Score, String(team.totalScore));
      if (team.logoPath && slotCfg.Logo) await drawLogo(ctx, slotCfg.Logo, team.logoPath);
    }

    if (layoutConf.BooyahGames) {
      for (const team of teams) {
        if (!team.BooyahsGame) continue;
        for (const gNo of team.BooyahsGame) {
          const cfg = layoutConf.BooyahGames[`Game${gNo}`];
          if (cfg) applyText(ctx, cfg, team.displayName);
          const lCfg = Array.isArray(layoutConf.BooyahGames.LogosBooyah)
            ? layoutConf.BooyahGames.LogosBooyah.find(l => l.game === gNo)
            : null;
          if (lCfg && team.logoPath) await drawLogo(ctx, lCfg, team.logoPath);
        }
      }
    }

    const outPath = path.join(bxhRoot, `bxh-${Date.now()}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer());

    let msgBody = `🏆 KẾT QUẢ TÍNH ĐIỂM LOGO 🏆\n\n`;
    msgBody += `📊 ID: ${accountId} | 🎯 Số trận: ${finalMatchCount}\n`;
    msgBody += `⏰ Thời gian: ${start.format("HH:mm DD/MM")} - ${end.format("HH:mm DD/MM")}\n`;
    msgBody += `🔑 Key: ${key} | 🔀 ID Bảng: ${idbangNum}\n`;

    if (xoaN) msgBody += `🗑️ Đã xóa: Trận ${xoaN.join(", ")}\n`;
    if (mode === "cpr") {
      const champTeam = champion ? teams.find(t => t.teamKey === champion.teamKey) : null;
      const voDichText = champTeam ? champTeam.displayName : "Chưa có";
      msgBody += `🔹 Mode CPR (${cprThreshold}đ) | 🏆 Vô địch: ${voDichText}\n`;
    }
    if (teamsWithLogoCount > 0) msgBody += `🖼️ Logo hồ sơ: ${teamsWithLogoCount}/${teams.length} team\n`;

    msgBody += `\n✨ HNHANN STUDIO`;

    api.sendMessage({ body: msgBody, attachment: fs.createReadStream(outPath) }, threadID, async (err) => {
      if (!err && !isFreeForUser) {
        try {
          const turnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
          const currentTurns = turnsData[senderID] || 0;
          if (currentTurns > 0) {
            turnsData[senderID] = currentTurns - 1;
            fs.writeJsonSync(turnsFilePath, turnsData, { spaces: 2 });
            const userInfo = await api.getUserInfo(senderID);
            const userName = (userInfo[senderID] && userInfo[senderID].name) || "Người dùng";
            api.changeNickname(`${userName} | ${currentTurns - 1} lượt`, threadID, senderID, () => {});
          }
        } catch (e) {
          console.error("[TDLG] Lỗi xử lý lượt dùng:", e);
        }
      }
      try { fs.unlinkSync(outPath); } catch { /* bỏ qua */ }
    }, messageID);
  }
  catch (e) {
    api.sendMessage("❌ Lỗi: " + e.message, threadID, messageID);
  }
}