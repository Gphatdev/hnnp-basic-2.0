const axios = require('axios');
const fs = require('fs');
const path = require('path');

const notesDirectory = path.resolve(__dirname, 'data', 'notes');
fs.mkdirSync(notesDirectory, { recursive: true });

function getSafeNotePath(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('Tên file không hợp lệ');
  const filePath = path.resolve(notesDirectory, fileName);
  if (filePath !== notesDirectory && !filePath.startsWith(`${notesDirectory}${path.sep}`)) {
    throw new Error('Đường dẫn file không hợp lệ');
  }
  return filePath;
}

module.exports = {
  config: {
    name: 'note',
    version: '0.0.2',
    hasPermssion: 3,
    credits: 'DC-Nam & Satoru',
    description: 'https://api.lunarkrystal.site/note/:UUID',
    commandCategory: 'Admin',
    usages: '[]',
    usePrefix: false, 
    images: [],
    cooldowns: 3,
  },
  run: async function(o) {
    const name = module.exports.config.name;
    const url = o.event?.messageReply?.args?.[0] || o.args[1];
    let filePath;
    const send = msg => new Promise(r => o.api.sendMessage(msg, o.event.threadID, (err, res) => r(res), o.event.messageID));
    
    try {
      filePath = getSafeNotePath(o.args[0]);
      if (/^https:\/\//.test(url)) {
        return send(`🔗 File: ${filePath}\n\nThả cảm xúc để xác nhận thay thế nội dung file`).then(res => {
          res = {
            ...res,
            name,
            path: filePath,
            o,
            url,
            action: 'confirm_replace_content',
          };
          global.client.handleReaction.push(res);
        });
      } else {
        if (!fs.existsSync(filePath)) return send(`❎ Đường dẫn file không tồn tại để export`);
        const uuid = require('uuid').v4();
        const editUrl = `https://api.lunarkrystal.site/note/${uuid}`;
        const rawUrl = `https://api.lunarkrystal.site/note/${uuid}-raw`;
        const fileContent = fs.readFileSync(filePath, 'utf8');
        await axios.put(editUrl, fileContent, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
          }
        });
        
        return send(`📄 Raw:\n${rawUrl}\n✏️ Edit:\n${editUrl}\n\n🔗 Path: ${filePath}\n\n📌 Thả cảm xúc để tải nội dung mới từ note`).then(res => {
          res = {
            ...res,
            name,
            path: filePath,
            o,
            url: rawUrl,
            action: 'confirm_replace_content',
          };
          global.client.handleReaction.push(res);
        });
      }
    } catch(e) {
      console.error(e);
      send(`❌ Lỗi: ${e.toString()}`);
    }
  },
  
  handleReaction: async function(o) {
    const _ = o.handleReaction;
    const send = msg => new Promise(r => o.api.sendMessage(msg, o.event.threadID, (err, res) => r(res), o.event.messageID));
    
    try {
      if (o.event.userID != _.o.event.senderID) return;
      
      switch (_.action) {
        case 'confirm_replace_content': {
          const content = (await axios.get(_.url, {
            responseType: 'text',
            headers: {
              'User-Agent': 'fetch' 
            }
          })).data;
          fs.writeFileSync(_.path, content);
          
          send(`✅ Đã tải và cập nhật file thành công!\n\n🔗 File: ${_.path}`).then(res => {
            res = {
              ..._,
              ...res,
            };
            global.client.handleReaction.push(res);
          });
        }
        break;
        
        default:
          break;
      }
    } catch(e) {
      console.error(e);
      send(`❌ Lỗi: ${e.toString()}`);
    }
  }
};