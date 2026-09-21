const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: "admin",
  version: "1.0.1",
  hasPermssion: 1,
  credits: "quocduy & AI",
  description: "Manage admins",
  commandCategory: "Admin",
  usages: "admin list/add/remove [userID]",
  cooldowns: 2,
  dependencies: {
    "fs-extra": ""
  }
};

module.exports.run = async function({ api, event, args }) {
  const configPath = path.join(process.cwd(), 'config.json');

  // Load the config file
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Get the list of admins
  const admins = config.NDH || [];

  // Handle different subcommands
  switch (args[0]) {
    case "list": 
      if (admins.length === 0) {
        api.sendMessage("There are no admins.", event.threadID, event.messageID);
      } else {
        const adminList = admins.map(admin => `- ${admin}`).join('\n');
        api.sendMessage(`Admins:\n${adminList}`, event.threadID, event.messageID);
      }
      break;

    case "add":
      const newAdminID = args[1];
      if (!newAdminID) {
        api.sendMessage("Please provide a user ID to add as an admin.", event.threadID, event.messageID);
        return;
      }
      if (admins.includes(newAdminID)) {
        api.sendMessage("This user is already an admin.", event.threadID, event.messageID);
        return;
      }
      admins.push(newAdminID);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      global.config.NDH = admins;
      api.sendMessage(`Added ${newAdminID} as an admin.`, event.threadID, event.messageID);
      break;

    case "remove":
      const adminToRemoveID = args[1];
      if (!adminToRemoveID) {
        api.sendMessage("Please provide a user ID to remove from admins.", event.threadID, event.messageID);
        return;
      }
      if (!admins.includes(adminToRemoveID)) {
        api.sendMessage("This user is not an admin.", event.threadID, event.messageID);
        return;
      }
      const adminIndex = admins.indexOf(adminToRemoveID);
      admins.splice(adminIndex, 1);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      global.config.NDH = admins;
      api.sendMessage(`Removed ${adminToRemoveID} from admins.`, event.threadID, event.messageID);
      break;

    default:
      const helpMessage = 
        "== [ ADMIN SETTING ] ==\n" +
        "1. admin list\n" +
        "   👉 Xem danh sách ID Admin hiện tại.\n\n" +
        "2. admin add [userID]\n" +
        "   👉 Thêm một ID người dùng vào danh sách Admin.\n\n" +
        "3. admin remove [userID]\n" +
        "   👉 Xóa một ID người dùng khỏi danh sách Admin.\n" +
        "========================";
      
      api.sendMessage(helpMessage, event.threadID, event.messageID);
      break;
  }
};