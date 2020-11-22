const wa = require("@open-wa/wa-automate");
const { create, decryptMedia, ev } = wa;
const { default: PQueue } = require("p-queue");
const fs = require("fs");
const express = require("express");

const helpText = `Commands:
#sticker: reply to or caption a image/video/gif to turn it into sticker
#spam: tag everyone in a message in a group
#spam {n}: spam n number of times
@everyone: spam but in a nicer way, works in between a message too
#join {link}: joing a group with invite link
#google {text}: reply to or to provide a idot with useful links
#help: To recive this same message
#leave: i hope you dont use this if you do make sure youre admin

Put '#nospam' in group description to stop spam commands
Made by: pathetic_geek (https://github.com/patheticGeek)
`;

/**
 * WA Client
 * @type {null | import("@open-wa/wa-automate").Client}
 */
let cl = null;
const server = express();
const PORT = parseInt(process.env.PORT) || 3000;
const queue = new PQueue({
  concurrency: 4,
  autoStart: false,
});

/**
 * Process the message
 * @param {import("@open-wa/wa-automate").Message} message
 */
async function procMess(message) {
  if (message.type === "chat") {
    if (message.body === "#help") {
      await cl.sendText(message.from, helpText);
    } else if (message.body.includes("@everyone") || message.body === "#spam") {
      if (
        message.chat.groupMetadata.desc &&
        message.chat.groupMetadata.desc.includes("#nospam")
      ) {
        await cl.reply(message.chatId, "Spam protected group", message.id);
      } else {
        const text = `@${
          message.author.split("@")[0]
        } says hello ${message.chat.groupMetadata.participants.map(
          (participant) => `\n🌚 @${participant.id.split("@")[0]}`
        )}`;
        await cl.sendTextWithMentions(message.chatId, text);
      }
    } else if (message.body.startsWith("#spam ")) {
      if (
        message.chat.groupMetadata.desc &&
        message.chat.groupMetadata.desc.includes("#nospam")
      ) {
        await cl.reply(message.chatId, "Spam protected group", message.id);
      } else {
        const n = parseInt(message.body.replace("#spam ", ""));
        const text = `@${
          message.author.split("@")[0]
        } says hello ${message.chat.groupMetadata.participants.map(
          (participant) => `\n🌚 @${participant.id.split("@")[0]}`
        )}`;
        const messages = [];
        for (let i = 0; i < n; i++) {
          messages.push(await cl.sendTextWithMentions(message.chatId, text));
        }
        await Promise.all(messages);
      }
    } else if (message.body.startsWith("#google")) {
      const query =
        message.body === "#google" && message.quotedMsgObj
          ? message.quotedMsgObj.body
          : message.body.replace("#google ", "");
      await cl.sendText(
        message.chatId,
        `https://www.google.com/search?q=${encodeURIComponent(query)}`
      );
    } else if (message.body.startsWith("#join https://chat.whatsapp.com/")) {
      await cl.joinGroupViaLink(message.body);
      await cl.sendText(message.chatId, "Joined group");
    } else if (
      message.body === "#sticker" &&
      message.quotedMsgObj &&
      ["image", "video"].includes(message.quotedMsgObj.type)
    ) {
      await cl.sendText(message.chatId, "Processing image");
      const mediaData = await decryptMedia(message.quotedMsgObj);
      const dataUrl = `data:${
        message.quotedMsgObj.mimetype
      };base64,${mediaData.toString("base64")}`;
      message.type === "image" &&
        (await cl.sendImageAsSticker(message.chatId, dataUrl));
      message.type === "video" &&
        (await cl.sendMp4AsSticker(message.chatId, dataUrl));
      await cl.reply(message.chatId, "Here is your sticker", message.id);
    } else if (message.body === "#leave") {
      const user = message.chat.groupMetadata.participants.find(
        (pat) => pat.id === message.author
      );
      if (user && user.isAdmin) {
        await cl.reply(
          message.chatId,
          "Ab unko humshe rishta nhi rakhna hai\nto humari taraf se bhi koi zabardasti nhi hai",
          message.id
        );
        await cl.leaveGroup(message.chat.id);
      } else {
        await cl.reply(message.chatId, "You no admin!", message.id);
      }
    }
  } else if (
    ["image", "video"].includes(message.type) &&
    message.caption === "#sticker"
  ) {
    await cl.sendText(message.chatId, "Processing image");
    const mediaData = await decryptMedia(message);
    const dataUrl = `data:${message.mimetype};base64,${mediaData.toString(
      "base64"
    )}`;
    message.type === "image" &&
      (await cl.sendImageAsSticker(message.chatId, dataUrl));
    message.type === "video" &&
      (await cl.sendMp4AsSticker(message.chatId, dataUrl));
    await cl.reply(message.chatId, "Here is your sticker", message.id);
  }
}

/**
 * Add message to process queue
 */
const processMessage = (message) => queue.add(() => procMess(message));

/**
 * Initialize client
 * @param {import("@open-wa/wa-automate").Client} client
 */
async function start(client) {
  cl = client;
  queue.start();
  const unreadMessages = await client.getAllUnreadMessages();
  unreadMessages.forEach(processMessage);
  client.onMessage(processMessage);
}

ev.on("qr.**", async (qrcode) => {
  const imageBuffer = Buffer.from(
    qrcode.replace("data:image/png;base64,", ""),
    "base64"
  );
  fs.writeFileSync("./public/qr_code.png", imageBuffer);
});

create({
  qrTimeout: 0,
}).then((client) => start(client));

server.use(express.static("public"));
server.listen(PORT, () =>
  console.log(`> Listining on http://localhost:${PORT}`)
);

process.on("exit", () => {
  if (fs.existsSync("./session.data.json")) {
    fs.unlinkSync("./session.data.json");
  }
});
