const wa = require("@open-wa/wa-automate");
const { create, decryptMedia, ev } = wa;
const { default: PQueue } = require("p-queue");
const fs = require("fs");
const express = require("express");

const helpOn = ["hello", "hi", "hii", "hey", "heyy", "#help", "#menu"];

const helpText =
  process.env.HELP_TEXT ||
  `Commands:
#sticker: caption a image/video/gif to turn it into sticker
#spam: tag everyone in a message in a group
#spam {n}: spam n number of times
#join {link}: joing a group with invite link provided
#google {query}: reply to a message or text with query to help a idot
#leave: i hope you dont use this if you do make sure youre admin
#help: To recive this same message

Put '#nospam' in group description to stop spam commands
Made by: pathetic_geek (https://github.com/patheticGeek)
`;

const leaveText =
  process.env.LEAVE_TEXT ||
  "Ab unko humshe rishta nhi rakhna hai\nto humari taraf se bhi koi zabardasti nhi hai";

const server = express();
const PORT = parseInt(process.env.PORT) || 3000;
const queue = new PQueue({
  concurrency: 4,
  autoStart: false,
});
/**
 * WA Client
 * @type {null | import("@open-wa/wa-automate").Client}
 */
let cl = null;

/**
 * Process the message
 * @param {import("@open-wa/wa-automate").Message} message
 */
async function procMess(message) {
  if (message.type === "chat") {
    if (helpOn.includes(message.body.toLowerCase())) {
      await cl.sendText(message.from, helpText);
    } else if (message.body.startsWith("#spam")) {
      if (
        message.chat.groupMetadata.desc &&
        message.chat.groupMetadata.desc.includes("#nospam")
      ) {
        await cl.sendText(message.chatId, "Spam protected group");
      } else {
        const text = `@${
          message.author.split("@")[0]
        } says hello ${message.chat.groupMetadata.participants.map(
          (participant) =>
            `\n🌚 @${
              typeof participant.id === "string"
                ? participant.id.split("@")[0]
                : participant.user
            }`
        )}`;
        if (message.body === "#spam") {
          await cl.sendTextWithMentions(message.chatId, text);
        } else {
          const n = parseInt(message.body.replace("#spam ", ""));
          if (n < 20) {
            const messages = [];
            for (let i = 0; i < n; i++) {
              messages.push(
                await cl.sendTextWithMentions(message.chatId, text)
              );
            }
            await Promise.all(messages);
          } else {
            await cl.sendText(message.chatId, "Spam limit 20");
          }
        }
      }
    } else if (message.body.startsWith("#google")) {
      const query =
        message.body === "#google" && message.quotedMsgObj
          ? message.quotedMsgObj.body
          : message.body.replace("#google ", "");
      await cl.sendText(
        message.chatId,
        `Here's something that'll help https://www.google.com/search?q=${encodeURIComponent(
          query
        )}`
      );
    } else if (message.body.startsWith("#join https://chat.whatsapp.com/")) {
      await cl.joinGroupViaLink(message.body);
      await cl.sendText(message.chatId, "Joined group");
    } else if (message.body === "#leave") {
      const user = message.chat.groupMetadata.participants.find(
        (pat) => pat.id === message.author
      );
      if (user && user.isAdmin) {
        await cl.sendText(message.chatId, leaveText);
        await cl.leaveGroup(message.chat.id);
      } else {
        await cl.sendText(message.chatId, "You no admin!");
      }
    }
  } else if (
    ["image", "video"].includes(message.type) &&
    message.caption === "#sticker"
  ) {
    await cl.sendText(message.chatId, "Processing sticker");
    const mediaData = await decryptMedia(message);
    const dataUrl = `data:${message.mimetype};base64,${mediaData.toString(
      "base64"
    )}`;
    try {
      message.type === "image" &&
        (await cl.sendImageAsSticker(message.chatId, dataUrl));
      message.type === "video" &&
        (await cl.sendMp4AsSticker(message.chatId, dataUrl));
      await cl.sendText(message.chatId, "Here is your sticker");
    } catch (e) {
      await cl.sendText(
        message.chatId,
        e.message || "Sticker size limit is 1Mb"
      );
    }
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
  cacheEnabled: false,
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
