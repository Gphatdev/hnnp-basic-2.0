const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const COMMAND_NAME = "accbot";

module.exports.config = {
  name: COMMAND_NAME,
  version: "1.0.1",
  hasPermssion: 3,
  credits: "NTKhang",
  description: "config bot!",
  usages: "Lệnh cho admin",
  commandCategory: "Admin",
  cooldowns: 5
};

module.exports.languages = {
  "vi": {},
  "en": {}
};

// ================== ĐỌC COOKIE ==================
// cookie.txt nằm ở thư mục gốc dự án (cùng chỗ với main.js, config.json)
let cookie = "";
try {
  const cookiePath = path.join(process.cwd(), "cookie.txt");
  const appState = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
  cookie = appState.map(item => (item.key || item.name) + "=" + item.value).join(";");
}
catch (e) {
  console.log("[accbot] Không đọc được cookie.txt:", e.message);
}

const headers = {
  "Host": "mbasic.facebook.com",
  "user-agent": "Mozilla/5.0 (Linux; Android 11; M2101K7BG Build/RP1A.200720.011;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "referer": "https://mbasic.facebook.com/?refsrc=deprecated&_rdr",
  "accept-encoding": "gzip, deflate",
  "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cookie": cookie
};

// ================== HÀM PHỤ ==================
function getGUID() {
  let d = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.floor((d + Math.random() * 16) % 16);
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x7) | 0x8).toString(16);
  });
}

function toBase64(str) {
  return Buffer.from(str).toString("base64");
}

function splitIDs(text) {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

// ================== XỬ LÝ REPLY ==================
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const ndh = (global.config.NDH || []).map(String);
  const admins = (global.config.ADMINBOT || []).map(String);
  if (!ndh.includes(String(event.senderID)) && !admins.includes(String(event.senderID)))
    return api.sendMessage("Bạn không được phép dùng lệnh này", event.threadID, () => {}, event.messageID);

  const botID = api.getCurrentUserID();

  const { type, author } = handleReply;
  const { threadID, messageID, senderID } = event;
  const body = event.body || "";
  if (author != senderID) return;

  const args = body.split(" ");

  const reply = function (msg, callback) {
    api.sendMessage(msg, threadID, callback || (() => {}), messageID);
  };

  const pushReply = function (info, data) {
    global.client.handleReply.push({
      name: COMMAND_NAME,
      messageID: info.messageID,
      author: senderID,
      ...data
    });
  };

  // ---------- MENU ----------
  if (type == "menu") {
    if (["01", "1", "02", "2"].includes(args[0])) {
      const isBio = ["01", "1"].includes(args[0]);
      reply(`Hãy phản hồi tin nhắn này với ${isBio ? "bio" : "biệt danh"} bạn muốn đổi cho bot hoặc 'delete' nếu muốn xóa ${isBio ? "bio" : "biệt danh"} hiện tại`, (err, info) => {
        if (err) return;
        pushReply(info, { type: isBio ? "changeBio" : "changeNickname" });
      });
    }
    else if (["03", "3"].includes(args[0])) {
      const messagePending = await api.getThreadList(500, null, ["PENDING"]);
      const msg = messagePending.reduce((a, b) => a += `» ${b.name} | ${b.threadID} | Tin nhắn: ${b.snippet}\n`, "") || "Không có tin nhắn nào";
      return reply(`Danh sách tin nhắn chờ của bot:\n\n${msg}`);
    }
    else if (["04", "4"].includes(args[0])) {
      const messagePending = await api.getThreadList(500, null, ["unread"]);
      const msg = messagePending.reduce((a, b) => a += `» ${b.name} | ${b.threadID} | Tin nhắn: ${b.snippet}\n`, "") || "Không có tin nhắn nào";
      return reply(`Danh sách tin nhắn chưa đọc của bot:\n\n${msg}`);
    }
    else if (["05", "5"].includes(args[0])) {
      const messagePending = await api.getThreadList(500, null, ["OTHER"]);
      const msg = messagePending.reduce((a, b) => a += `» ${b.name} | ${b.threadID} | Tin nhắn: ${b.snippet}\n`, "") || "Không có tin nhắn nào";
      return reply(`Danh sách tin nhắn spam của bot:\n\n${msg}`);
    }
    else if (["06", "6"].includes(args[0])) {
      reply(`Phản hồi tin nhắn này kèm ảnh hoặc link ảnh muốn đổi thành avatar bot`, (err, info) => {
        if (err) return;
        pushReply(info, { type: "changeAvatar" });
      });
    }
    else if (["07", "7"].includes(args[0])) {
      if (!args[1] || !["on", "off"].includes(args[1])) return reply("Vui lòng chọn on hoặc off (ví dụ: 7 on)");
      const form = {
        av: botID,
        variables: JSON.stringify({
          "0": {
            is_shielded: args[1] == "on",
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19)
          }
        }),
        doc_id: "1477043292367183"
      };
      api.httpPost("https://www.facebook.com/api/graphql/", form, (err, data) => {
        let hasError = !!err;
        if (!hasError) {
          try { hasError = !!JSON.parse(data).errors; }
          catch (e) { hasError = true; }
        }
        if (hasError) reply("Đã xảy ra lỗi, vui lòng thử lại sau");
        else reply(`» Đã ${args[1] == "on" ? "bật" : "tắt"} khiên avatar của bot thành công`);
      });
    }
    else if (["08", "8"].includes(args[0])) {
      return reply(`Phản hồi tin nhắn này với id của người bạn muốn chặn, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng`, (e, info) => {
        if (e) return;
        pushReply(info, { type: "blockUser" });
      });
    }
    else if (["09", "9"].includes(args[0])) {
      return reply(`Phản hồi tin nhắn này với id của người bạn muốn bỏ chặn, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng`, (e, info) => {
        if (e) return;
        pushReply(info, { type: "unBlockUser" });
      });
    }
    else if (["10"].includes(args[0])) {
      return reply(`Phản hồi tin nhắn này với nội dung muốn tạo bài viết`, (e, info) => {
        if (e) return;
        pushReply(info, { type: "createPost" });
      });
    }
    else if (["11"].includes(args[0])) {
      return reply(`Phản hồi tin nhắn này với id bài viết bạn muốn xóa, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng`, (e, info) => {
        if (e) return;
        pushReply(info, { type: "deletePost" });
      });
    }
    else if (["12", "13"].includes(args[0])) {
      const isGroup = args[0] == "13";
      return reply(`Phản hồi tin nhắn này với postID muốn comment (bài viết ${isGroup ? "trên group" : "của user"}), có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng`, (e, info) => {
        if (e) return;
        pushReply(info, { type: "choiceIdCommentPost", isGroup });
      });
    }
    else if (["14", "15", "16", "17", "18", "19"].includes(args[0])) {
      const actionText = {
        "14": "thả cảm xúc",
        "15": "gửi lời mời kết bạn",
        "16": "chấp nhận lời mời kết bạn",
        "17": "từ chối lời mời kết bạn",
        "18": "xóa bạn bè",
        "19": "gửi tin nhắn"
      };
      const typeMap = {
        "14": "choiceIdReactionPost",
        "15": "addFiends",
        "16": "acceptFriendRequest",
        "17": "deleteFriendRequest",
        "18": "unFriends",
        "19": "choiceIdSendMessage"
      };
      const target = args[0] == "14" ? "id bài viết" : "id người dùng";
      reply(`Phản hồi tin nhắn này kèm ${target} muốn ${actionText[args[0]]}, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng`, (e, info) => {
        if (e) return;
        pushReply(info, { type: typeMap[args[0]] });
      });
    }
    else if (["20"].includes(args[0])) {
      reply("Phản hồi tin nhắn này kèm đoạn code bạn muốn tạo ghi chú", (e, info) => {
        if (e) return;
        pushReply(info, { type: "noteCode" });
      });
    }
    else if (["21"].includes(args[0])) {
      api.logout((e) => {
        if (e) return reply("Đã xảy ra lỗi, vui lòng thử lại sau");
        else console.log("»» LOGOUT SUCCESS ««");
      });
    }
  }


  // ---------- ĐỔI BIO ----------
  else if (type == "changeBio") {
    const bio = body.toLowerCase() == "delete" ? "" : body;
    api.changeBio(bio, false, (err) => {
      if (err) return reply("Đã xảy ra lỗi, vui lòng thử lại sau");
      else return reply(`Đã ${!bio ? "xóa tiểu sử của bot thành công" : `thay đổi tiểu sử bot thành: ${bio}`}`);
    });
  }


  // ---------- ĐỔI BIỆT DANH ----------
  else if (type == "changeNickname") {
    const nickname = body.toLowerCase() == "delete" ? "" : body;
    let res;
    try {
      res = (await axios.get("https://mbasic.facebook.com/" + botID + "/about", {
        headers,
        params: {
          nocollections: "1",
          lst: `${botID}:${botID}:${Date.now().toString().slice(0, 10)}`,
          refid: "17"
        }
      })).data;
    }
    catch (err) {
      return reply("Đã xảy ra lỗi khi tải trang thông tin, vui lòng kiểm tra lại cookie.txt");
    }

    try {
      const cacheDir = path.join(__dirname, "cache");
      fs.ensureDirSync(cacheDir);
      fs.writeFileSync(path.join(cacheDir, "resNickname.html"), res);
    }
    catch (e) { /* bỏ qua lỗi ghi cache */ }

    const marker = 'href="/profile/edit/info/nicknames/?entid=';
    const collectionToken = toBase64("app_collection:" + botID + ":2327158227:206");
    const sectionToken = toBase64("app_section:" + botID + ":2327158227");

    let form;
    if (nickname) {
      const name_id = res.includes(marker) ? res.split(marker)[1].split("&amp;")[0] : null;

      const variables = {
        collectionToken,
        input: {
          name_text: nickname,
          name_type: "NICKNAME",
          show_as_display_name: true,
          actor_id: botID,
          client_mutation_id: Math.round(Math.random() * 19).toString()
        },
        scale: 3,
        sectionToken
      };

      if (name_id) variables.input.name_id = name_id;

      form = {
        av: botID,
        fb_api_req_friendly_name: "ProfileCometNicknameSaveMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "4126222767480326",
        variables: JSON.stringify(variables)
      };
    }
    else {
      if (!res.includes(marker)) return reply("Bot của bạn hiện tại chưa đặt tên biệt danh nào");
      const name_id = res.split(marker)[1].split("&amp;")[0];
      form = {
        av: botID,
        fb_api_req_friendly_name: "ProfileCometAboutFieldItemDeleteMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "4596682787108894",
        variables: JSON.stringify({
          collectionToken,
          input: {
            entid: name_id,
            field_type: "nicknames",
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          scale: 3,
          sectionToken,
          isNicknameField: true,
          useDefaultActor: false
        })
      };
    }

    api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
      if (e) return reply("Đã xảy ra lỗi, vui lòng thử lại sau");
      let parsed;
      try { parsed = JSON.parse(i); }
      catch (err) { return reply("Đã xảy ra lỗi, vui lòng thử lại sau"); }
      if (parsed.errors) reply(`Đã xảy ra lỗi: ${parsed.errors[0].summary}, ${parsed.errors[0].description}`);
      else reply(`Đã ${!nickname ? "xoá tên biệt danh của bot thành công" : `đổi tên biệt danh của bot thành: ${nickname}`}`);
    });
  }


  // ---------- ĐỔI AVATAR ----------
  else if (type == "changeAvatar") {
    let imgUrl;
    if (body && /^https?:\/\/\S+$/i.test(body.trim())) imgUrl = body.trim();
    else if (event.attachments && event.attachments[0] && event.attachments[0].type == "photo") imgUrl = event.attachments[0].url;
    else return reply("Vui lòng nhập link hình ảnh hợp lệ hoặc phản hồi tin nhắn kèm một ảnh muốn đặt làm avatar cho bot", (err, info) => {
      if (err) return;
      pushReply(info, { type: "changeAvatar" });
    });

    try {
      const imgBuffer = (await axios.get(imgUrl, {
        responseType: "stream"
      })).data;
      const form0 = {
        file: imgBuffer
      };
      let uploadImageToFb = await api.httpPostFormData(`https://www.facebook.com/profile/picture/upload/?profile_id=${botID}&photo_source=57&av=${botID}`, form0);
      uploadImageToFb = JSON.parse(uploadImageToFb.split("for (;;);")[1]);
      if (uploadImageToFb.error) return reply("Đã xảy ra lỗi: " + uploadImageToFb.error.errorDescription);
      const idPhoto = uploadImageToFb.payload.fbid;
      const form = {
        av: botID,
        fb_api_req_friendly_name: "ProfileCometProfilePictureSetMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "5066134240065849",
        variables: JSON.stringify({
          input: {
            caption: "",
            existing_photo_id: idPhoto,
            expiration_time: null,
            profile_id: botID,
            profile_pic_method: "EXISTING",
            profile_pic_source: "TIMELINE",
            scaled_crop_rect: {
              height: 1,
              width: 1,
              x: 0,
              y: 0
            },
            skip_cropping: true,
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          isPage: false,
          isProfile: true,
          scale: 3
        })
      };
      api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
        if (e) return reply("Đã xảy ra lỗi, vui lòng thử lại sau");
        let parsed;
        try { parsed = JSON.parse(i.slice(0, i.indexOf("\n") + 1) || i); }
        catch (err) { return reply("Đã xảy ra lỗi, vui lòng thử lại sau"); }
        if (parsed.errors) reply(`Đã xảy ra lỗi: ${parsed.errors[0].description}`);
        else reply("Đã thay đổi avatar cho bot thành công");
      });
    }
    catch (err) {
      reply("Đã xảy ra lỗi, vui lòng thử lại sau");
    }
  }


  // ---------- CHẶN NGƯỜI DÙNG ----------
  else if (type == "blockUser") {
    if (!body) return reply("Vui lòng nhập uid của những người bạn muốn chặn trên messenger, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng", (e, info) => {
      if (e) return;
      pushReply(info, { type: "blockUser" });
    });
    const uids = splitIDs(body);
    const success = [];
    const failed = [];
    for (const uid of uids) {
      try {
        await api.changeBlockedStatus(uid, true);
        success.push(uid);
      }
      catch (err) {
        failed.push(uid);
      }
    }
    reply(`» Đã chặn thành công ${success.length} người dùng trên messenger${failed.length > 0 ? `\n» Chặn thất bại ${failed.length} người dùng, id: ${failed.join(" ")}` : ""}`);
  }


  // ---------- BỎ CHẶN ----------
  else if (type == "unBlockUser") {
    if (!body) return reply("Vui lòng nhập uid của những người bạn muốn bỏ chặn trên messenger, có thể nhập nhiều id cách nhau bằng dấu cách hoặc xuống dòng", (e, info) => {
      if (e) return;
      pushReply(info, { type: "unBlockUser" });
    });
    const uids = splitIDs(body);
    const success = [];
    const failed = [];
    for (const uid of uids) {
      try {
        await api.changeBlockedStatus(uid, false);
        success.push(uid);
      }
      catch (err) {
        failed.push(uid);
      }
    }
    reply(`» Đã bỏ chặn thành công ${success.length} người dùng trên messenger${failed.length > 0 ? `\n» Bỏ chặn thất bại ${failed.length} người dùng, id: ${failed.join(" ")}` : ""}`);
  }


  // ---------- TẠO BÀI VIẾT ----------
  else if (type == "createPost") {
    if (!body) return reply("Vui lòng nhập nội dung muốn tạo bài viết", (e, info) => {
      if (e) return;
      pushReply(info, { type: "createPost" });
    });

    const session_id = getGUID();
    const form = {
      av: botID,
      fb_api_req_friendly_name: "ComposerStoryCreateMutation",
      fb_api_caller_class: "RelayModern",
      doc_id: "4612917415497545",
      variables: JSON.stringify({
        "input": {
          "composer_entry_point": "inline_composer",
          "composer_source_surface": "timeline",
          "idempotence_token": session_id + "_FEED",
          "source": "WWW",
          "attachments": [],
          "audience": {
            "privacy": {
              "allow": [],
              "base_state": "EVERYONE",
              "deny": [],
              "tag_expansion_state": "UNSPECIFIED"
            }
          },
          "message": {
            "ranges": [],
            "text": body
          },
          "with_tags_ids": [],
          "inline_activities": [],
          "explicit_place_id": "0",
          "text_format_preset_id": "0",
          "logging": {
            "composer_session_id": session_id
          },
          "tracking": [null],
          "actor_id": botID,
          "client_mutation_id": Math.round(Math.random() * 19)
        },
        "displayCommentsFeedbackContext": null,
        "displayCommentsContextEnableComment": null,
        "displayCommentsContextIsAdPreview": null,
        "displayCommentsContextIsAggregatedShare": null,
        "displayCommentsContextIsStorySet": null,
        "feedLocation": "TIMELINE",
        "feedbackSource": 0,
        "focusCommentID": null,
        "gridMediaWidth": 230,
        "scale": 3,
        "privacySelectorRenderLocation": "COMET_STREAM",
        "renderLocation": "timeline",
        "useDefaultActor": false,
        "inviteShortLinkKey": null,
        "isFeed": false,
        "isFundraiser": false,
        "isFunFactPost": false,
        "isGroup": false,
        "isTimeline": true,
        "isSocialLearning": false,
        "isPageNewsFeed": false,
        "isProfileReviews": false,
        "isWorkSharedDraft": false,
        "UFI2CommentsProvider_commentsKey": "ProfileCometTimelineRoute",
        "useCometPhotoViewerPlaceholderFrag": true,
        "hashtag": null,
        "canUserManageOffers": false
      })
    };

    api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
      try {
        if (e) throw e;
        const parsed = JSON.parse(i);
        if (parsed.errors) throw new Error("graphql error");
        const postID = parsed.data.story_create.story.legacy_story_hideable_id;
        const urlPost = parsed.data.story_create.story.url;
        return reply(`» Đã tạo bài viết thành công\n» postID: ${postID}\n» urlPost: ${urlPost}`);
      }
      catch (err) {
        return reply("Tạo bài viết thất bại, vui lòng thử lại sau");
      }
    });
  }


  // ---------- COMMENT: CHỌN POST ----------
  else if (type == "choiceIdCommentPost") {
    if (!body) return reply("Vui lòng nhập id của post bạn muốn comment", (e, info) => {
      if (e) return;
      pushReply(info, { type: "choiceIdCommentPost", isGroup: handleReply.isGroup });
    });
    reply("Phản hồi tin nhắn này kèm nội dung bạn muốn comment cho bài viết", (e, info) => {
      if (e) return;
      pushReply(info, {
        postIDs: splitIDs(body),
        type: "commentPost",
        isGroup: handleReply.isGroup
      });
    });
  }


  // ---------- COMMENT: GỬI NỘI DUNG ----------
  else if (type == "commentPost") {
    const { postIDs, isGroup } = handleReply;

    if (!body) return reply("Vui lòng nhập nội dung bạn muốn comment cho bài viết", (e, info) => {
      if (e) return;
      pushReply(info, { type: "commentPost", postIDs, isGroup });
    });
    const success = [];
    const failed = [];

    for (const id of postIDs) {
      const postID = toBase64("feedback:" + id);
      const ss1 = getGUID();
      const ss2 = getGUID();

      const form = {
        av: botID,
        fb_api_req_friendly_name: "CometUFICreateCommentMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "4744517358977326",
        variables: JSON.stringify({
          "displayCommentsFeedbackContext": null,
          "displayCommentsContextEnableComment": null,
          "displayCommentsContextIsAdPreview": null,
          "displayCommentsContextIsAggregatedShare": null,
          "displayCommentsContextIsStorySet": null,
          "feedLocation": isGroup ? "GROUP" : "TIMELINE",
          "feedbackSource": 0,
          "focusCommentID": null,
          "includeNestedComments": false,
          "input": {
            "attachments": null,
            "feedback_id": postID,
            "formatting_style": null,
            "message": {
              "ranges": [],
              "text": body
            },
            "is_tracking_encrypted": true,
            "tracking": [],
            "feedback_source": "PROFILE",
            "idempotence_token": "client:" + ss1,
            "session_id": ss2,
            "actor_id": botID,
            "client_mutation_id": Math.round(Math.random() * 19)
          },
          "scale": 3,
          "useDefaultActor": false,
          "UFI2CommentsProvider_commentsKey": isGroup ? "CometGroupDiscussionRootSuccessQuery" : "ProfileCometTimelineRoute"
        })
      };

      try {
        const res = await api.httpPost("https://www.facebook.com/api/graphql/", form);
        if (JSON.parse(res).errors) failed.push(id);
        else success.push(id);
      }
      catch (err) {
        failed.push(id);
      }
    }
    reply(`» Đã comment thành công ${success.length} bài viết${failed.length > 0 ? `\n» Comment thất bại ${failed.length} bài viết, postID: ${failed.join(" ")}` : ""}`);
  }


  // ---------- XÓA BÀI VIẾT ----------
  else if (type == "deletePost") {
    const postIDs = splitIDs(body);
    const success = [];
    const failed = [];

    for (const postID of postIDs) {
      try {
        let res = (await axios.get("https://mbasic.facebook.com/story.php?story_fbid=" + postID + "&id=" + botID, {
          headers
        })).data;

        const session_ID = decodeURIComponent(res.split("session_id%22%3A%22")[1].split("%22%2C%22")[0]);
        const hideable_token = decodeURIComponent(res.split("%22%2C%22hideable_token%22%3A%")[1].split("%22%2C%22")[0]);

        let URl = "https://mbasic.facebook.com/nfx/basic/direct_actions/?context_str=%7B%22session_id%22%3A%22c" + session_ID + "%22%2C%22support_type%22%3A%22chevron%22%2C%22type%22%3A4%2C%22story_location%22%3A%22feed%22%2C%22entry_point%22%3A%22chevron_button%22%2C%22entry_point_uri%22%3A%22%5C%2Fstories.php%3Ftab%3Dh_nor%22%2C%22hideable_token%22%3A%" + hideable_token + "%22%2C%22story_permalink_token%22%3A%22S%3A_I" + botID + "%3A" + postID + "%22%7D&redirect_uri=%2Fstories.php%3Ftab%3Dh_nor&refid=8&__tn__=%2AW-R";

        res = (await axios.get(URl, {
          headers
        })).data;

        URl = res.split('method="post" action="/nfx/basic/handle_action/?')[1].split('"')[0];
        URl = "https://mbasic.facebook.com/nfx/basic/handle_action/?" + URl
          .replace(/&amp;/g, "&")
          .replace("%5C%2Fstories.php%3Ftab%3Dh_nor", "https%3A%2F%2Fmbasic.facebook.com%2Fprofile.php%3Fv%3Dfeed")
          .replace("%2Fstories.php%3Ftab%3Dh_nor", "https%3A%2F%2Fmbasic.facebook.com%2Fprofile.php%3Fv%3Dfeed");

        const fb_dtsg = res.split('type="hidden" name="fb_dtsg" value="')[1].split('" autocomplete="off" /><input')[0];
        const jazoest = res.split('type="hidden" name="jazoest" value="')[1].split('" autocomplete="off" />')[0];

        const data = "fb_dtsg=" + encodeURIComponent(fb_dtsg) + "&jazoest=" + encodeURIComponent(jazoest) + "&action_key=DELETE&submit=G%E1%BB%ADi";

        const dt = await axios({
          url: URl,
          method: "post",
          headers,
          data
        });
        if (dt.data.includes("Rất tiếc, đã xảy ra lỗi")) throw new Error("delete failed");
        success.push(postID);
      }
      catch (err) {
        failed.push(postID);
      }
    }
    reply(`» Đã xóa thành công ${success.length} bài viết${failed.length > 0 ? `\n» Xóa thất bại ${failed.length} bài viết (id không tồn tại hoặc không phải bài của bot), postID: ${failed.join(" ")}` : ""}`);
  }


  // ---------- REACTION: CHỌN POST ----------
  else if (type == "choiceIdReactionPost") {
    if (!body) return reply("Vui lòng nhập id bài viết bạn muốn reaction", (e, info) => {
      if (e) return;
      pushReply(info, { type: "choiceIdReactionPost" });
    });

    const listID = splitIDs(body);

    reply(`Nhập cảm xúc bạn muốn reaction cho ${listID.length} bài viết (unlike/like/love/heart/haha/wow/sad/angry)`, (e, info) => {
      if (e) return;
      pushReply(info, { listID, type: "reactionPost" });
    });
  }


  // ---------- REACTION: GỬI CẢM XÚC ----------
  else if (type == "reactionPost") {
    const success = [];
    const failed = [];
    const postIDs = handleReply.listID;
    const feeling = body.toLowerCase().trim();
    if (!"unlike/like/love/heart/haha/wow/sad/angry".split("/").includes(feeling)) return reply("Vui lòng chọn một trong những cảm xúc sau: unlike/like/love/heart/haha/wow/sad/angry", (e, info) => {
      if (e) return;
      pushReply(info, { listID: postIDs, type: "reactionPost" });
    });
    for (const postID of postIDs) {
      try {
        await api.setPostReaction(Number(postID), feeling);
        success.push(postID);
      }
      catch (err) {
        failed.push(postID);
      }
    }
    reply(`» Đã thả cảm xúc ${feeling} cho ${success.length} bài viết thành công${failed.length > 0 ? `\n» Reaction thất bại ${failed.length} bài viết, postID: ${failed.join(" ")}` : ""}`);
  }


  // ---------- KẾT BẠN ----------
  else if (type == "addFiends") {
    const listID = splitIDs(body);
    const success = [];
    const failed = [];

    for (const uid of listID) {
      const form = {
        av: botID,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "FriendingCometFriendRequestSendMutation",
        doc_id: "5090693304332268",
        variables: JSON.stringify({
          input: {
            friend_requestee_ids: [uid],
            refs: [null],
            source: "profile_button",
            warn_ack_for_ids: [],
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          scale: 3
        })
      };
      try {
        const sendAdd = await api.httpPost("https://www.facebook.com/api/graphql/", form);
        if (JSON.parse(sendAdd).errors) failed.push(uid);
        else success.push(uid);
      }
      catch (e) {
        failed.push(uid);
      }
    }
    reply(`» Đã gửi lời mời kết bạn thành công cho ${success.length} id${failed.length > 0 ? `\n» Gửi lời mời kết bạn đến ${failed.length} id thất bại: ${failed.join(" ")}` : ""}`);
  }


  // ---------- GỬI TIN NHẮN: CHỌN ID ----------
  else if (type == "choiceIdSendMessage") {
    const listID = splitIDs(body);
    reply(`Nhập nội dung tin nhắn bạn muốn gửi cho ${listID.length} user`, (e, info) => {
      if (e) return;
      pushReply(info, { listID, type: "sendMessage" });
    });
  }


  // ---------- XÓA BẠN BÈ ----------
  else if (type == "unFriends") {
    const listID = splitIDs(body);
    const success = [];
    const failed = [];

    for (const idUnfriend of listID) {
      const form = {
        av: botID,
        fb_api_req_friendly_name: "FriendingCometUnfriendMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "4281078165250156",
        variables: JSON.stringify({
          input: {
            source: "bd_profile_button",
            unfriended_user_id: idUnfriend,
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19)
          },
          scale: 3
        })
      };
      try {
        const sendAdd = await api.httpPost("https://www.facebook.com/api/graphql/", form);
        const parsed = JSON.parse(sendAdd);
        if (parsed.errors) failed.push(`${idUnfriend}: ${parsed.errors[0].summary}`);
        else success.push(idUnfriend);
      }
      catch (e) {
        failed.push(idUnfriend);
      }
    }
    reply(`» Đã xóa thành công ${success.length} bạn bè${failed.length > 0 ? `\n» Xóa thất bại ${failed.length} bạn bè:\n${failed.join("\n")}` : ""}`);
  }


  // ---------- GỬI TIN NHẮN ----------
  else if (type == "sendMessage") {
    const listID = handleReply.listID;
    const success = [];
    const failed = [];
    for (const uid of listID) {
      try {
        const sendMsg = await api.sendMessage(body, uid);
        if (!sendMsg || !sendMsg.messageID) failed.push(uid);
        else success.push(uid);
      }
      catch (e) {
        failed.push(uid);
      }
    }
    reply(`» Đã gửi tin nhắn thành công cho ${success.length} user${failed.length > 0 ? `\n» Gửi tin nhắn đến ${failed.length} user thất bại: ${failed.join(" ")}` : ""}`);
  }


  // ---------- CHẤP NHẬN / TỪ CHỐI LỜI MỜI KẾT BẠN ----------
  else if (type == "acceptFriendRequest" || type == "deleteFriendRequest") {
    const listID = splitIDs(body);

    const success = [];
    const failed = [];

    for (const uid of listID) {
      const form = {
        av: botID,
        fb_api_req_friendly_name: type == "acceptFriendRequest" ? "FriendingCometFriendRequestConfirmMutation" : "FriendingCometFriendRequestDeleteMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: type == "acceptFriendRequest" ? "3147613905362928" : "4108254489275063",
        variables: JSON.stringify({
          input: {
            friend_requester_id: uid,
            source: "friends_tab",
            actor_id: botID,
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          scale: 3,
          refresh_num: 0
        })
      };
      try {
        const friendRequest = await api.httpPost("https://www.facebook.com/api/graphql/", form);
        if (JSON.parse(friendRequest).errors) failed.push(uid);
        else success.push(uid);
      }
      catch (e) {
        failed.push(uid);
      }
    }
    reply(`» Đã ${type == "acceptFriendRequest" ? "chấp nhận" : "xóa"} lời mời kết bạn thành công của ${success.length} id${failed.length > 0 ? `\n» Thất bại với ${failed.length} id: ${failed.join(" ")}` : ""}`);
  }


  // ---------- TẠO GHI CHÚ CODE ----------
  else if (type == "noteCode") {
    axios({
      url: "https://buildtool.dev/verification",
      method: "post",
      data: `content=${encodeURIComponent(body)}&code_class=language${encodeURIComponent("-")}javascript`
    })
      .then(response => {
        const href = response.data.split('<a href="code-viewer.php?')[1].split('">Permanent link</a>')[0];
        reply(`Tạo ghi chú thành công, link: ${"https://buildtool.dev/code-viewer.php?" + href}`);
      })
      .catch(err => {
        reply("Đã xảy ra lỗi, vui lòng thử lại sau");
      });
  }
};


// ================== LỆNH CHÍNH ==================
module.exports.run = async ({ event, api }) => {
  const { threadID, messageID, senderID } = event;

  api.sendMessage("⚙️⚙️ Command List ⚙️⚙️"
    + "\n[1] Chỉnh sửa tiểu sử bot"
    + "\n[2] Chỉnh sửa tên biệt danh của bot"
    + "\n[3] Xem tin nhắn đang chờ"
    + "\n[4] Xem tin nhắn chưa đọc"
    + "\n[5] Xem tin nhắn spam"
    + "\n[6] Đổi avatar bot"
    + "\n[7] Bật khiên avatar bot <on/off>"
    + "\n[8] Chặn người dùng (messenger)"
    + "\n[9] Bỏ chặn người dùng (messenger)"
    + "\n[10] Tạo bài viết"
    + "\n[11] Xóa bài viết"
    + "\n[12] Comment bài viết (user)"
    + "\n[13] Comment bài viết (group)"
    + "\n[14] Thả cảm xúc bài viết"
    + "\n[15] Kết bạn bằng id"
    + "\n[16] Chấp nhận lời mời kết bạn bằng id"
    + "\n[17] Từ chối lời mời kết bạn bằng id"
    + "\n[18] Xóa bạn bè bằng id"
    + "\n[19] Gửi tin nhắn bằng id"
    + "\n[20] Tạo ghi chú trên buildtool.dev"
    + "\n[21] Đăng xuất tài khoản"
    + "\n````````````````````````````````"
    + `\n» Admin ID:\n${(global.config.ADMINBOT || []).join("\n")}`
    + `\n» Bot ID: ${api.getCurrentUserID()}`
    + "\n» Hãy phản hồi tin nhắn này kèm số thứ tự của lệnh bạn muốn thực hiện"
    + "\n````````````````````````````````", threadID, (err, info) => {
      if (err) return;
      global.client.handleReply.push({
        name: COMMAND_NAME,
        messageID: info.messageID,
        author: senderID,
        type: "menu"
      });
    }, messageID);
};