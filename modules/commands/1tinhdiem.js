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

// ====== TÍCH HỢP HSG ======
let hsgModule = null;
try {
  hsgModule = require(path.join(__dirname, "hsg.js"));
  console.log("[TD] Đã tải module HSG thành công.");
} catch (e) {
  console.warn("[TD] Không tìm thấy module HSG, tính năng nhận diện logo team tự động sẽ bị tắt:", e.message);
}

function findTeamLogo(teamName) {
  if (!hsgModule || typeof hsgModule.findLogoByTeamName !== "function") return null;
  if (!teamName || !teamName.trim()) return null;
  try {
    const result = hsgModule.findLogoByTeamName(teamName);
    if (result && result.logoPath && fs.existsSync(result.logoPath)) {
      console.log(`[TD] Đã tìm thấy logo HSG cho đội "${teamName}": ${result.logoPath}`);
      return result.logoPath;
    }
  } catch (e) {
    console.warn(`[TD] Lỗi khi truy xuất logo đội "${teamName}":`, e.message);
  }
  return null;
}
// ==========================

fs.ensureDirSync(dataRoot);
fs.ensureDirSync(fontsPath);
fs.ensureDirSync(bxhRoot);
fs.ensureDirSync(layoutsRoot);
fs.ensureFileSync(turnsFilePath);
fs.ensureFileSync(vohanFilePath);
fs.ensureFileSync(vohanBoxFilePath);

fs.readdirSync(fontsPath).filter((f) => f.endsWith(".ttf") || f.endsWith(".otf")).forEach((f) => {
  const fontFile = path.join(fontsPath, f);
  const fontName = path.basename(f, path.extname(f));
  try {
    registerFont(fontFile, { family: fontName });
    console.log("✅ Đã nạp font:", fontName);
  }
  catch (err) {
    console.error("❌ Lỗi nạp font:", f, err.message);
  }
});

const TIME_SLOTS = {
  1: ["13:00", "15:00"], 2: ["15:00", "17:00"], 3: ["18:00", "20:00"],
  4: ["20:00", "21:50"], 5: ["21:40", "23:00"], 6: ["23:00", "01:00"],
  7: ["01:00", "03:00"], 8: ["10:00", "12:00"],
};
const REPLY_NAME = "td";

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
      return m[1].split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1);
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
    if (/^\d{1,2}:\d{2}$/.test(token) || /^\d{2}\/\d{2}\/\d{4}$/.test(token)) continue;
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
    fs.writeFileSync(keysPath, JSON.stringify({ gphat: { ct: "", ct2: "", idbang: "5", logo: "", admins: [], ctvs: [] } }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(keysPath, "utf8"));
  }
  catch (e) {
    throw new Error("File keys.json bị lỗi định dạng: " + e.message);
  }
}

async function loadLayoutById(idbang) {
  const id = String(idbang);
  const layoutDir = path.join(layoutsRoot, id);
  const layoutJson = path.join(layoutDir, "layout.json");
  const bgPath = path.join(layoutDir, "background.png");
  if (!fs.existsSync(layoutJson)) throw new Error(`Không tìm thấy layout.json cho ID "${id}"`);
  if (!fs.existsSync(bgPath)) throw new Error(`Không tìm thấy background.png cho ID "${id}"`);
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
    console.warn("⚠️ Không thể tải logo:", logoPath, e.message);
  }
}

function normalizeCustomTimeStr(t) {
  if (!t) return null;
  t = t.toLowerCase().replace('h', ':');
  if (!t.includes(':')) t += ':00';
  let [h, m] = t.split(':');
  if (!m) m = '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
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

function normalizeDateTime(inputDate, inputTime) {
  let [d, m, y] = inputDate.split("/").map((s) => s.trim());
  if (!d || !m || !y) throw new Error(`Ngày không hợp lệ: "${inputDate}"`);
  d = parseInt(d, 10);
  m = parseInt(m, 10);
  y = parseInt(y, 10);
  if (!(d >= 1 && d <= 31)) throw new Error(`Ngày phải nằm trong khoảng 1-31: "${inputDate}"`);
  if (!(m >= 1 && m <= 12)) throw new Error(`Tháng phải nằm trong khoảng 1-12: "${inputDate}"`);
  if (!/^\d{4}$/.test(String(y))) throw new Error(`Năm phải đủ 4 chữ số: "${inputDate}"`);

  const dd = d < 10 ? "0" + d : String(d);
  const mm = m < 10 ? "0" + m : String(m);
  const yyyy = String(y);

  let hh = null, min = null;
  const timeStr = inputTime.trim();
  if (/^\d{1,2}h\d{1,2}$/.test(timeStr)) {
    [hh, min] = timeStr.split("h").map((n) => parseInt(n, 10));
  } else if (/^\d{1,2}h$/.test(timeStr)) {
    hh = parseInt(timeStr.replace("h", ""), 10);
    min = 0;
  } else if (/^\d{1,2}:\d{1,2}$/.test(timeStr)) {
    [hh, min] = timeStr.split(":").map((n) => parseInt(n, 10));
  } else {
    throw new Error(`Định dạng giờ không chuẩn: "${inputTime}"`);
  }
  if (!(hh >= 0 && hh <= 23)) throw new Error(`Giờ phải nằm trong khoảng 0-23: "${inputTime}"`);
  if (!(min >= 0 && min <= 59)) throw new Error(`Phút phải nằm trong khoảng 0-59: "${inputTime}"`);

  const HH = hh < 10 ? "0" + hh : String(hh);
  const MM = min < 10 ? "0" + min : String(min);
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
}

function parseFullTimeArgs(args) {
  const accountId = args[0];
  const tail = args.slice(1);
  if (tail.length < 4) throw new Error("⚠️ Thông tin thời gian bắt đầu hoặc kết thúc chưa đầy đủ.");

  let startStr, endStr;
  try {
    startStr = normalizeDateTime(tail[0], tail[1]);
    endStr = normalizeDateTime(tail[2], tail[3]);
  } catch (err) {
    throw new Error(`❌ Cấu trúc thời gian sai: ${err.message}`);
  }

  const start = moment.tz(startStr, "DD/MM/YYYY HH:mm", TIME_ZONE);
  const end = moment.tz(endStr, "DD/MM/YYYY HH:mm", TIME_ZONE);
  if (!start.isValid()) throw new Error(`❌ Mốc bắt đầu không hợp lệ: "${tail[0]} ${tail[1]}"`);
  if (!end.isValid()) throw new Error(`❌ Mốc kết thúc không hợp lệ: "${tail[2]} ${tail[3]}"`);
  if (start.isSameOrAfter(end)) {
    throw new Error(`❌ Thời gian bắt đầu phải trước thời gian kết thúc.\n• Bắt đầu: ${startStr}\n• Kết thúc: ${endStr}`);
  }

  const extraTokens = tail.slice(4);
  const xoaN = parseXoaToken(extraTokens);
  const key = parseKeyToken(extraTokens) || "gphat";
  const cpr = parseCprToken(extraTokens);
  const mode = cpr ? "cpr" : "normal";
  return { accountId, start, end, key, xoaN, mode, cprThreshold: cpr };
}

module.exports.config = {
  name: "td",
  version: "3.3",
  hasPermssion: 0,
  credits: "Dev by LEGI STUDIO - ZanHau | Upgraded by Gemini",
  description: "Hệ thống tính điểm Custom tự động chuyên nghiệp.",
  commandCategory: "game",
  usages: "[id] [key] [xoaN] [cprN]",
  cooldowns: 5
};

module.exports.run = async ({ args, api, event }) => {
  const { threadID, messageID, senderID } = event;

  try {
    const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
    const threadLimit = limitData[threadID];
    if (threadLimit && threadLimit.game === false) {
      return api.sendMessage("🚫 Nhóm của bạn đang bị giới hạn sử dụng tính năng Game.", threadID, messageID);
    }
  } catch (e) {
    console.log("Lỗi kiểm tra tệp limit.json:", e);
  }

  if (!args.length) {
    const helpMsg = `📖 HƯỚNG DẪN SỬ DỤNG LỆNH TÍNH ĐIỂM (.TD)\n`
      + `────────────────────\n`
      + `⚙️ CÚ PHÁP CƠ BẢN:\n`
      + `.td [ID_Garena] [Key] [Lệnh_Bổ_Sung]\n\n`
      + `🛠 LỆNH BỔ SUNG (TÙY CHỌN):\n`
      + `• xoaN: Loại bỏ trận lỗi (VD: xoa1 hoặc xoa1,2,3)\n`
      + `• cprN: Kích hoạt chế độ CPR với mốc điểm N (VD: cpr41)\n\n`
      + `⏰ CÁCH CHỌN KHUNG GIỜ GIỜ KHẢ DỤNG:\n`
      + `• Phản hồi số 1-8 để dùng khung giờ cố định.\n`
      + `• Phản hồi giờ cụ thể: "20:00 11/06" (Mặc định tính 2 tiếng).\n`
      + `• Phản hồi khoảng giờ: "20h - 23h 11/06".\n`
      + `• Tự động xử lý thông minh nếu trận đấu kéo dài qua đêm.\n\n`
      + `💡 MẪU CÂU LỆNH CHUẨN:\n`
      + `.td 123456789 gphat xoa2 cpr41`;
    return api.sendMessage(helpMsg, threadID, messageID);
  }

  // Chế độ nhập đủ thời gian: .td [id] dd/mm/yyyy hh:mm dd/mm/yyyy hh:mm [key] [xoaN] [cprN]
  // Chỉ vào chế độ này khi tham số thứ 2 thật sự là một ngày dd/mm/yyyy
  if (args.length >= 5 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(args[1])) {
    try {
      const flowArgs = parseFullTimeArgs(args);
      return executeFlow({ ...flowArgs, api, event });
    }
    catch (err) {
      return api.sendMessage(err.message, threadID, messageID);
    }
  }

  const accountId = args[0];
  const tail = args.slice(1);
  const xoaN = parseXoaToken(tail);
  const key = parseKeyToken(tail) || "gphat";
  const cpr = parseCprToken(tail);
  const mode = cpr ? "cpr" : "normal";

  let keysConf = {};
  try { keysConf = ensureKeysConfig(); }
  catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }

  const keyConf = keysConf[key] || keysConf["gphat"];
  if (!keyConf) return api.sendMessage(`❌ Không tìm thấy thông tin cho key "${key}".`, threadID, messageID);

  const allowAdmins = Array.isArray(keyConf.admins) ? keyConf.admins.map(String) : [];
  const allowCtvs = Array.isArray(keyConf.ctvs) ? keyConf.ctvs.map(String) : [];
  if ((allowAdmins.length || allowCtvs.length) && !(allowAdmins.includes(String(senderID)) || allowCtvs.includes(String(senderID)))) {
    return api.sendMessage(`🔒 Bạn không có quyền vận hành key "${key}".`, threadID, messageID);
  }

  const uInfo = await api.getUserInfo(senderID).catch(() => ({}));
  const senderName = (uInfo && uInfo[senderID] && uInfo[senderID].name) || "Người dùng";

  const menuMsg = `📋 VUI LÒNG CHỌN KHUNG GIỜ TÍNH ĐIỂM\n`
    + `────────────────────\n`
    + `1. 13:00 ➟ 15:00\n`
    + `2. 15:00 ➟ 17:00\n`
    + `3. 18:00 ➟ 20:00\n`
    + `4. 20:00 ➟ 21:50\n`
    + `5. 21:40 ➟ 23:00\n`
    + `6. 23:00 ➟ 01:00\n`
    + `7. 01:00 ➟ 03:00\n`
    + `8. 10:00 ➟ 12:00\n\n`
    + `💬 TÙY CHỌN THỜI GIAN RIÊNG:\n`
    + `• Theo ngày: "20:00 11/06" (hoặc 20h)\n`
    + `• Theo khoảng: "20:00 - 23:00 11/06"\n\n`
    + `👤 Người yêu cầu: ${senderName}`;

  return api.sendMessage(
    menuMsg,
    threadID,
    (err, info) => {
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
    },
    messageID
  );
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

  const textInput = body.trim();
  if (!textInput) return;
  const { accountId, key, xoaN, mode, cprThreshold } = handleReply.data;

  const customTimeRegex = /^(\d{1,2}[:h]\d{0,2})(?:\s*-\s*(\d{1,2}[:h]\d{0,2}))?\s+(\d{1,2}\/\d{1,2})$/i;
  const match = textInput.match(customTimeRegex);

  if (match) {
    const startStr = normalizeCustomTimeStr(match[1]);
    const endStr = match[2] ? normalizeCustomTimeStr(match[2]) : null;
    const dateStr = match[3];

    const currentYear = moment().tz(TIME_ZONE).year();
    const start = moment.tz(`${dateStr}/${currentYear} ${startStr}`, "D/M/YYYY HH:mm", TIME_ZONE);

    if (!start.isValid()) {
      return api.sendMessage("❌ Mốc thời gian bắt đầu không hợp lệ.", threadID, messageID);
    }

    let end;
    if (endStr) {
      end = moment.tz(`${dateStr}/${currentYear} ${endStr}`, "D/M/YYYY HH:mm", TIME_ZONE);
      if (end.isBefore(start)) end.add(1, "day");
    } else {
      end = moment(start).add(2, "hours");
    }

    if (!end.isValid()) {
      return api.sendMessage("❌ Mốc thời gian kết thúc không hợp lệ.", threadID, messageID);
    }

    safeUnsend(api, handleReply.messageID);
    api.sendMessage(`⏳ Đang xử lý dữ liệu từ ${start.format("HH:mm")} đến ${end.format("HH:mm")} (${start.format("DD/MM")})...`, threadID);

    return executeFlow({ api, event, accountId, start, end, key, xoaN, mode, cprThreshold });
  }

  const selected = textInput.split(",").map((s) => s.trim()).filter((s) => s !== "");
  const slotIds = selected.map((n) => parseInt(n, 10)).filter((n) => TIME_SLOTS[n]);

  if (!slotIds.length) {
    return api.sendMessage("❌ Lựa chọn không hợp lệ. Vui lòng phản hồi số từ 1-8 hoặc nhập khoảng thời gian chuẩn.", threadID, messageID);
  }

  safeUnsend(api, handleReply.messageID);

  for (const slotId of slotIds) {
    const timeRange = computeStartEndFromToday(slotId);
    if (!timeRange) continue;

    if (slotId === 6 || slotId === 7) {
      api.sendMessage(`⏳ Đang tổng hợp dữ liệu khung ca đêm (${timeRange.start.format("DD/MM")})...`, threadID);
    }

    await executeFlow({ api, event, accountId, start: timeRange.start, end: timeRange.end, key, xoaN, mode, cprThreshold });
  }
};

async function executeFlow({ api, event, accountId, start, end, key = "gphat", xoaN = null, mode = "normal", cprThreshold = null }) {
  const { threadID, messageID, senderID } = event;
  let isFreeForUser = false;

  // Kiểm tra gói Vô Hạn theo Box
  try {
    const vohanBoxData = fs.readJsonSync(vohanBoxFilePath, { throws: false }) || {};
    const boxStatus = vohanBoxData[threadID];
    if (boxStatus && boxStatus.expiry) {
      const expiryDate = moment(boxStatus.expiry);
      if (moment().isBefore(expiryDate)) {
        if (boxStatus.scope === 'all') {
          isFreeForUser = true;
        } else if (boxStatus.scope === 'admin') {
          const threadInfo = await api.getThreadInfo(threadID);
          if (threadInfo.adminIDs.some(admin => admin.id == senderID)) isFreeForUser = true;
        }
      } else {
        delete vohanBoxData[threadID];
        fs.writeJsonSync(vohanBoxFilePath, vohanBoxData, { spaces: 2 });
      }
    }
  } catch (e) {
    console.error("[TINHDIEM] Lỗi kiểm tra gói Vô Hạn Box:", e);
  }

  // Kiểm tra gói Vô Hạn cá nhân
  if (!isFreeForUser) {
    try {
      const vohanData = fs.readJsonSync(vohanFilePath, { throws: false }) || {};
      if (vohanData[senderID] && moment().isBefore(moment(vohanData[senderID]))) {
        isFreeForUser = true;
      } else if (vohanData[senderID]) {
        delete vohanData[senderID];
        fs.writeJsonSync(vohanFilePath, vohanData, { spaces: 2 });
      }
    } catch (e) {
      console.error("[TINHDIEM] Lỗi kiểm tra gói Vô Hạn cá nhân:", e);
    }
  }

  // Kiểm tra lượt dùng
  if (!isFreeForUser) {
    try {
      const turnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
      const userTurns = turnsData[senderID] || 0;
      if (userTurns <= 0) {
        return api.sendMessage(`⚠️ Tài khoản của bạn đã hết lượt dùng.\nVui lòng gia hạn để tiếp tục sử dụng tính năng!`, threadID, messageID);
      }
    } catch (e) {
      console.error("[TINHDIEM] Lỗi truy xuất số lượt khả dụng:", e);
      return api.sendMessage("❌ Lỗi hệ thống kiểm tra lượt dùng, vui lòng thử lại sau.", threadID, messageID);
    }
  }

  let keysConf = {};
  try { keysConf = ensureKeysConfig(); }
  catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }

  const keyConf = keysConf[key] || keysConf["gphat"];
  if (!keyConf) return api.sendMessage("❌ Không tìm thấy thông tin cấu hình key mặc định.", threadID, messageID);

  const allowAdmins = Array.isArray(keyConf.admins) ? keyConf.admins.map(String) : [];
  const allowCtvs = Array.isArray(keyConf.ctvs) ? keyConf.ctvs.map(String) : [];
  if ((allowAdmins.length || allowCtvs.length) && !(allowAdmins.includes(String(senderID)) || allowCtvs.includes(String(senderID)))) {
    return api.sendMessage(`🔒 Bạn không có quyền vận hành key "${key}".`, threadID, messageID);
  }

  let matchIds = [];
  try {
    matchIds = await garenaApi.findMatches(accountId, start, end);
  } catch (e) {
    console.error(e);
    return api.sendMessage("❌ Không thể kết nối đến máy chủ Garena hoặc ID hết lượt, vui lòng thử lại sau.", threadID, messageID);
  }
  if (!matchIds || !matchIds.length) {
    return api.sendMessage("⚠️ Không phát hiện dữ liệu trận đấu trong khung giờ đã chọn.", threadID, messageID);
  }

  let matchDetails = [];
  try {
    matchDetails = await garenaApi.getMatchDetails(matchIds);
  } catch (e) {
    console.error(e);
    return api.sendMessage("❌ Lỗi khi tải chi tiết trận đấu từ hệ thống Garena.", threadID, messageID);
  }

  if (Array.isArray(xoaN) && xoaN.length > 0) {
    const sorted = [...xoaN].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (Number.isInteger(idx) && idx >= 1 && idx <= matchDetails.length) matchDetails.splice(idx - 1, 1);
    }
  }

  const { teams, champion, finalMatchCount } = aggregateTeams(matchDetails, mode, cprThreshold || 41);
  if (!teams.length) {
    return api.sendMessage("⚠️ Không thể trích xuất danh sách đội thi đấu.", threadID, messageID);
  }

  const teamLogoMap = new Map();
  for (const team of teams) {
    const logoPath = findTeamLogo(team.displayName);
    teamLogoMap.set(team.teamKey, logoPath || null);
  }

  const logoFromKey = keyConf.logo && String(keyConf.logo).trim() ? keyConf.logo : null;
  const layoutId = String(keyConf.idbang || "21");
  let layoutPack;
  try {
    layoutPack = await loadLayoutById(layoutId);
  } catch (e) {
    console.error(e);
    return api.sendMessage("❌ " + e.message, threadID, messageID);
  }

  try {
    const { layoutConf, bgImg } = layoutPack;
    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bgImg, 0, 0);
    const customName = keyConf.ct || key;
    const customName2 = keyConf.ct2 || key;
    const customTime = formatCustomTime(start.clone());

    if (layoutConf.header) {
      if (layoutConf.header.customName) applyText(ctx, layoutConf.header.customName, customName);
      if (layoutConf.header.customName2) applyText(ctx, layoutConf.header.customName2, customName2);
      if (layoutConf.header.customTime) applyText(ctx, layoutConf.header.customTime, customTime);
      if (layoutConf.header.logos && Array.isArray(layoutConf.header.logos)) {
        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];
          const logoCfg = layoutConf.header.logos[i];
          if (!logoCfg) continue;
          const logoToUse = teamLogoMap.get(team.teamKey) || logoFromKey;
          if (logoToUse) await drawLogo(ctx, logoCfg, logoToUse);
        }
        for (const customKey of ["custom1", "custom2", "custom3"]) {
          const customLogo = layoutConf.header.logos.find((l) => String(l.top).toLowerCase() === customKey);
          if (customLogo && logoFromKey) await drawLogo(ctx, customLogo, logoFromKey);
        }
      }
    }

    const maxRow = layoutConf.limit || 10;
    const rows = Math.min(maxRow, teams.length);
    for (let i = 0; i < rows; i++) {
      const team = teams[i];
      const slotKey = `Top${i + 1}`;
      const slotCfg = layoutConf[slotKey];
      if (!slotCfg) continue;
      const teamName = team.displayName || "Không tên";
      if (slotCfg.Top) applyText(ctx, slotCfg.Top, String(team.Top || i + 1));
      if (slotCfg.Name) applyText(ctx, slotCfg.Name, teamName);
      if (slotCfg.Kill) applyText(ctx, slotCfg.Kill, String(team.totalKills || 0));
      if (slotCfg.Booyah) applyText(ctx, slotCfg.Booyah, String(team.totalBooyahs || 0));
      if (slotCfg.Score) applyText(ctx, slotCfg.Score, String(team.totalScore || 0));
      if (slotCfg.Logo) {
        const logoToUse = teamLogoMap.get(team.teamKey) || logoFromKey;
        if (logoToUse) await drawLogo(ctx, slotCfg.Logo, logoToUse);
      }
    }

    if (layoutConf.BooyahGames) {
      for (const team of teams) {
        if (!team.BooyahsGame || team.BooyahsGame.length === 0) continue;
        for (const g of team.BooyahsGame) {
          const slotCfg = layoutConf.BooyahGames[`Game${g}`];
          if (slotCfg) applyText(ctx, slotCfg, team.displayName);
          if (Array.isArray(layoutConf.BooyahGames.LogosBooyah)) {
            const logoCfg = layoutConf.BooyahGames.LogosBooyah.find((l) => l.game === g);
            if (logoCfg) {
              const logoToUse = teamLogoMap.get(team.teamKey) || logoFromKey;
              if (logoToUse) await drawLogo(ctx, logoCfg, logoToUse);
            }
          }
        }
      }
    }

    const outPath = path.join(bxhRoot, `bxh-${layoutId}-${key}-${Date.now()}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer());

    const teamsWithLogo = teams.filter(t => teamLogoMap.get(t.teamKey)).length;

    let msgBody = "✨ [ BẢNG XẾP HẠNG THI ĐẤU ] ✨\n────────────────────\n";
    msgBody += `🎮 Tài khoản ID: ${accountId}\n`;
    msgBody += `⚔️ Tổng số trận: ${finalMatchCount}\n`;
    msgBody += `⏰ Khung giờ: ${start.format("HH:mm DD/MM")} ➟ ${end.format("HH:mm DD/MM")}\n`;
    msgBody += `🔑 Mã Key: ${key}\n`;
    msgBody += `🖼 ID Thiết kế: ${layoutId}\n`;
    if (xoaN) msgBody += `🗑️ Loại bỏ trận: ${xoaN.join(", ")}\n`;

    if (mode === "cpr") {
      if (cprThreshold) msgBody += `🎯 Mốc điểm CPR: ${cprThreshold}\n`;
      let voDichText = "Chưa xác định";
      if (champion) {
        const champTeam = teams.find(t => t.teamKey === champion.teamKey);
        if (champTeam) voDichText = champTeam.displayName;
      }
      msgBody += `🏆 Đội vô địch CPR: ${voDichText}\n`;
    }

    if (teamsWithLogo > 0) msgBody += `🏷️ Nhận diện Logo HSG: ${teamsWithLogo}/${teams.length} đội\n`;

    api.sendMessage({ body: msgBody.trim(), attachment: fs.createReadStream(outPath) }, threadID, async (err, info) => {
      if (err) {
        console.error("[TINHDIEM] Lỗi gửi kết quả:", err);
        try { fs.unlinkSync(outPath); } catch {}
        return;
      }
      if (!isFreeForUser) {
        try {
          const currentTurnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
          const currentUserTurns = currentTurnsData[senderID] || 0;
          if (currentUserTurns > 0) {
            const newTurns = currentUserTurns - 1;
            currentTurnsData[senderID] = newTurns;
            fs.writeJsonSync(turnsFilePath, currentTurnsData, { spaces: 2 });
            const userInfo = await api.getUserInfo(senderID);
            const userName = (userInfo[senderID] && userInfo[senderID].name) || "Người dùng";
            api.changeNickname(`${userName} | ${newTurns} lượt`, threadID, senderID, (err) => {
              if (err) console.log(`[TINHDIEM] Lỗi cập nhật danh xưng cho ${senderID}:`, err.errorDescription);
            });
          }
        } catch (e) {
          console.error("[TINHDIEM] Lỗi xử lý lượt dùng:", e);
        }
      }
      try { fs.unlinkSync(outPath); } catch {}
    }, messageID);
  }
  catch (e) {
    console.error(e);
    api.sendMessage("❌ Lỗi trong quá trình xuất hình ảnh kết quả: " + e.message, threadID, messageID);
  }
}