module.exports.config = {
  name: "autoduyet",
  eventType: ["log:thread-approval"], // Bắt sự kiện hàng chờ duyệt thành viên
  version: "1.0.5",
  credits: "Gemini",
  description: "Tự động duyệt thành viên vào nhóm và log ra console (Chạy ngầm)",
  // Các trường dưới đây giúp file không bị báo "Lỗi định dạng" nếu lỡ để trong modules/commands
  hasPermssion: 2,
  commandCategory: "Admin",
  usages: "Tự chạy ngầm, không cần gõ lệnh",
  cooldowns: 5
};

// Nếu file bị tải như một lệnh thì lệnh này không làm gì cả
module.exports.run = async function ({ api, event }) {
  // Không phải sự kiện duyệt thành viên -> bỏ qua
  if (!event || event.logMessageType !== "log:thread-approval") return;

  const { threadID } = event;
  const logData = event.logMessageData || {};
  const requesterID = logData.requester_id || logData.requesterID || event.author;

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const threadName = threadInfo.threadName || "Nhóm không tên";
    const botID = String(api.getCurrentUserID());
    const isBotAdmin = (threadInfo.adminIDs || []).some(e => String(e.id) === botID);

    // Bot không phải QTV thì bỏ qua để không báo lỗi
    if (!isBotAdmin) return;

    if (typeof api.handleGroupMembershipRequest === "function") {
      // Duyệt người mới
      await api.handleGroupMembershipRequest(threadID, requesterID, true);

      console.log(`\x1b[32m[AUTO DUYỆT]\x1b[0m Đã duyệt tự động 1 thành viên cho nhóm: ${threadName} (ID: ${threadID})`);

      // Thêm // ở đầu dòng dưới nếu muốn bot im lặng
      api.sendMessage("🤖 [AUTO] Đã tự động duyệt thành viên mới vào nhóm!", threadID);
    }
    else {
      // Bản fca cũ: quét toàn bộ hàng chờ
      const queue = threadInfo.approvalQueue;
      if (queue && queue.length > 0) {
        let count = 0;
        for (const user of queue) {
          try {
            await api.addUserToGroup(user.requesterID, threadID);
            count++;
          }
          catch (e) {
            console.error(`\x1b[31m[AUTO DUYỆT]\x1b[0m Không duyệt được ${user.requesterID}:`, e.message || e);
          }
        }
        console.log(`\x1b[32m[AUTO DUYỆT]\x1b[0m Đã duyệt tự động ${count} thành viên cho nhóm: ${threadName} (ID: ${threadID})`);
        api.sendMessage(`🤖 [AUTO] Đã quét và tự động duyệt ${count} người vào nhóm!`, threadID);
      }
    }
  }
  catch (error) {
    console.error(`\x1b[31m[AUTO DUYỆT]\x1b[0m Lỗi ngầm tại nhóm ${threadID}:`, error);
  }
};