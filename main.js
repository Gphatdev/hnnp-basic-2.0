const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");
//const login = require("../fca-unofficial");
const fs = require('fs-extra');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const moment = require('moment-timezone');
const createHumanSend = require('./utils/humanSend.js');
const cleanupStartupFiles = require('./utils/cleanup.js');
const autoLogin = require('./autologin.js');

const bannerGradient = gradient([
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7ff',
  '#5856d6',
  '#af52de'
]);

console.log(bannerGradient.multiline(figlet.textSync('HNNP STUDOnp', {
  font: 'ANSI Shadow',
  horizontalLayout: 'full'
})));
cleanupStartupFiles(__dirname, logger);
if (!fs.existsSync('./utils/data')) {
  fs.mkdirSync('./utils/data', { recursive: true });
}
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleReaction: [],
  handleReply: [],
  mainPath: process.cwd(),
  configPath: "",
  getTime: option => moment.tz("Asia/Ho_Chi_minh").format({ seconds: "ss", minutes: "mm", hours: "HH", date: "DD", month: "MM", year: "YYYY", fullHour: "HH:mm:ss", fullYear: "DD/MM/YYYY", fullTime: "HH:mm:ss DD/MM/YYYY" }[option])
};
global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});

global.utils = require("./utils/func.js");
global.config = require('./config.json');
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();
global.anti = resolve(__dirname, "./includes/data/anti/anti.json");

function watchConfigChanges() {
  const configPath = join(__dirname, "config.json");
  let previousAccess = {
    ADMINBOT: [...(global.config.ADMINBOT || [])],
    NDH: [...(global.config.NDH || [])]
  };

  fs.watchFile(configPath, { interval: 1000 }, () => {
    try {
      const updatedConfig = JSON.parse(readFileSync(configPath, "utf8"));
      const currentAccess = {
        ADMINBOT: [...(updatedConfig.ADMINBOT || [])],
        NDH: [...(updatedConfig.NDH || [])]
      };
      const accessChanged = JSON.stringify(previousAccess) !== JSON.stringify(currentAccess);

      Object.assign(global.config, updatedConfig);
      if (accessChanged) {
        const addedAdmin = currentAccess.ADMINBOT.filter(id => !previousAccess.ADMINBOT.includes(id));
        const addedNdh = currentAccess.NDH.filter(id => !previousAccess.NDH.includes(id));
        const added = [
          ...addedAdmin.map(id => `ADMINBOT: ${id}`),
          ...addedNdh.map(id => `NDH: ${id}`)
        ];
        logger(
          added.length ? `Đã cập nhật quyền thành công: ${added.join(", ")}` : "Đã cập nhật danh sách ADMINBOT/NDH thành công.",
          "[ CONFIG ] >"
        );
      }
      previousAccess = currentAccess;
    } catch (error) {
      logger(`Không thể đọc lại config.json: ${error.message}`, "error");
    }
  });
}

watchConfigChanges();

const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}
global.getText = function (...args) {
    const langText = global.language;    
    if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}
function onBot({ models }) {
  autoLogin({
    rootDirectory: __dirname,
    config: global.config,
    parseCookies: global.utils.parseCookies,
    logger
  }, async (loginError, api) => {
        if (loginError) return console.log(loginError);
        api.setOptions(global.config.FCAOption);
        api.sendMessage = createHumanSend(api);
        global.config.version = '3.0.0';
        global.client.timeStart = new Date().getTime();
        global.client.api = api;
        const userId = api.getCurrentUserID();
        const user = await api.getUserInfo([userId]);
        const userName = user[userId]?.name || null;
        logger(`Đăng nhập thành công - ${userName} (${userId})`, '[ LOGIN ] >');
        (function () {
            const loadModules = (path, collection, disabledList, type) => {
              const items = readdirSync(path).filter(file => file.endsWith('.js') && !file.includes('example') && !disabledList.includes(file));
              let loadedCount = 0;   
              for (const file of items) {
                try {
                  const item = require(join(path, file));
                  const { config, run, onLoad, handleEvent } = item;
                  if (!config || !run || (type === 'commands' && !config.commandCategory)) {
                    throw new Error(`Lỗi định dạng trong ${type === 'commands' ? 'lệnh' : 'sự kiện'}: ${file}`);
                  }  
                  if (global.client[collection].has(config.name)) {
                    throw new Error(`Tên ${type === 'commands' ? 'lệnh' : 'sự kiện'} đã tồn tại: ${config.name}`);
                  }
                  if (config.envConfig) {
                    global.configModule[config.name] = global.configModule[config.name] || {};
                    global.config[config.name] = global.config[config.name] || {};  
                    for (const key in config.envConfig) {
                      global.configModule[config.name][key] = global.config[config.name][key] || config.envConfig[key] || '';
                      global.config[config.name][key] = global.configModule[config.name][key];
                    }
                  }
                  if (onLoad) onLoad({ api, models });
                  if (handleEvent) global.client.eventRegistered.push(config.name);
                  global.client[collection].set(config.name, item);
                  loadedCount++;
                } catch (error) {
                  console.error(`Lỗi khi tải ${type === 'commands' ? 'lệnh' : 'sự kiện'} ${file}:`, error);
                }
              }
              if (loadedCount === 0) {
                console.log(`Không tìm thấy ${type === 'commands'? 'lệnh' :'sự kiện'} nào trong thư mục ${path}`); 
              }
              return loadedCount;
            };
            const commandPath = join(global.client.mainPath, 'modules', 'commands');
            const eventPath = join(global.client.mainPath, 'modules', 'events');
            const loadedCommandsCount = loadModules(commandPath, 'commands', global.config.commandDisabled, 'commands');
            logger.loader(`Loaded ${loadedCommandsCount} commands`);    
            const loadedEventsCount = loadModules(eventPath, 'events', global.config.eventDisabled, 'events');
            logger.loader(`Loaded ${loadedEventsCount} events`);
        })();
        logger.loader(' Ping load source: ' + (Date.now() - global.client.timeStart) + 'ms');
        writeFileSync('./config.json', JSON.stringify(global.config, null, 4), 'utf8');
        const listener = require('./includes/listen.js')({ api, models });
        function listenerCallback(error, event) {
          if (error) {
            if (JSON.stringify(error).includes("601051028565049")) {
              const form = {
                av: api.getCurrentUserID(),
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "FBScrapingWarningMutation",
                variables: "{}",
                server_timestamps: "true",
                doc_id: "6339492849481770",
              };
              api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
                const res = JSON.parse(i);
                if (e || res.errors) return logger("Lỗi không thể xóa cảnh cáo của facebook.", "error");
                if (res.data.fb_scraping_warning_clear.success) {
                  logger("Đã vượt cảnh cáo facebook thành công.", "[ SUCCESS ] >");
                  global.handleListen = api.listenMqtt(listenerCallback);
                  setTimeout(connect_mqtt, 1000 * 60 * 60);
                  logger(global.getText('mirai', 'successConnectMQTT'), '[ MQTT ]');
                }
              });
            } else {
              return logger(global.getText("mirai", "handleListenError", JSON.stringify(error)), "error");
            }
          }
          if (["presence", "typ", "read_receipt"].some((data) => data === event?.type)) return;
          if (global.config.DeveloperMode) console.log(event);
          return listener(event);
        }
        function connect_mqtt() {
          if (global.handleListen) global.handleListen.stopListening?.();
          global.handleListen = api.listenMqtt(listenerCallback);
          setTimeout(connect_mqtt, 1000 * 60 * 60);
          logger(global.getText('mirai', 'successConnectMQTT'), '[ MQTT ]');
        }
        connect_mqtt();
    });
}
(async() => {
    try {
        const { Sequelize, sequelize } = require("./includes/database/index.js");
        await sequelize.authenticate();
        const models = require('./includes/database/model.js')({ Sequelize, sequelize });
        logger(global.getText('mirai', 'successConnectDatabase'), '[ DATABASE ]');
        onBot({ models });
    } catch (error) { 
        console.log(error);
      }
})();
process.on("unhandledRejection", (err, p) => {console.log(p)});