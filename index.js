const wa = require("@open-wa/wa-automate");
const { create, decryptMedia, ev } = wa;
const { default: PQueue } = require("p-queue");
const fs = require("fs");
const express = require("express");

const helpOnInPM = ["hello", "hi", "hii", "hey", "heyy", "#help", "#menu"];
const helpOnInGroup = ["#help", "#menu"];

const helpText =
  process.env.HELP_TEXT ||
  `Commands:
#sticker: write in caption of a image/video/gif to turn it into sticker
#spam: tag everyone in a message in a group
#join https://chat.whatsapp.com/shdkashdh: joing a group with invite link
#leave: i hope you dont use this if you do make sure youre admin
#help: To recive this same message
#menu: Same as help but some people prefer it

Put '#nospam' in group description to stop spam commands
Made by: pathetic_geek (https://github.com/patheticGeek)
`;

const leaveText =
  process.env.LEAVE_TEXT ||
  "Ab unko humshe rishta nhi rakhna hai\nto humari taraf se bhi koi zabardasti nhi hai";

const server = express();
const PORT = parseInt(process.env.PORT) || 3000;
const queue = new PQueue({
  concurrency: 2,
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
    if (
      helpOnInGroup.includes(message.body.toLowerCase()) ||
      helpOnInPM.includes(message.body.toLowerCase())
    ) {
      await cl.sendText(message.from, helpText);
    } else if (message.body === "#spam") {
      if (
        message.chat.groupMetadata.desc &&
        message.chat.groupMetadata.desc.includes("#nospam")
      ) {
        await cl.sendText(message.chatId, "Spam protected group");
      } else {
        const text = `hello ${message.chat.groupMetadata.participants.map(
          (participant) =>
            `\n🌚 @${
              typeof participant.id === "string"
                ? participant.id.split("@")[0]
                : participant.user
            }`
        )}`;
        await cl.sendTextWithMentions(message.chatId, text);
      }
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
