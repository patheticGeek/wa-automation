const wa = require("@open-wa/wa-automate");
const { create, decryptMedia, ev } = wa;
const { default: PQueue } = require("p-queue");
const fs = require("fs");
const express = require("express");
const axios = require("axios").default;

const helpOnInPM = ["hello", "hi", "hii", "hey", "heyy", "#help", "#menu"];
const helpOnInGroup = ["#help", "#menu"];

const helpText =
  process.env.HELP_TEXT ||
  `Commands:
#sticker: write in caption of a image/video/gif to turn it into sticker
#spam: tag everyone in a message in a group (only works in a group)
#join https://chat.whatsapp.com/shdkashdh: joing a group with invite link
#leave: i hope you dont use this (only works in a group if sent by an admin)
#help: to recive this same message
#menu: same as help but some people prefer it
#run languages: Returns all languages supported
#run {language}
{code}: Run some code in some language
eg.
'#run node
console.log('hello world');'

Add '#nospam' in group description to stop spam commands
All commands except #spam & #leave work in pm
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
      message.isGroupMsg &&
      helpOnInGroup.includes(message.body.toLowerCase())
    ) {
      await cl.sendText(message.from, helpText);
    } else if (
      !message.isGroupMsg &&
      helpOnInPM.includes(message.body.toLowerCase())
    ) {
      await cl.sendText(message.from, helpText);
    } else if (message.isGroupMsg && message.body.toLowerCase() === "#spam") {
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
    } else if (message.body === "#run languages") {
      const response = await axios.get(
        "https://emkc.org/api/v1/piston/versions"
      );
      const reply = response.data
        .map((item) => `${item.name} - v${item.version}`)
        .join("\n");
      cl.sendText(message.chatId, reply);
    } else if (message.body.startsWith("#run ")) {
      const { chatId, body } = message;
      try {
        let msg = body.replace("#run ", "").split("\n");
        const lang = msg.splice(0, 1)[0];
        const source = msg.join("\n");
        const response = await axios.post(
          "https://emkc.org/api/v1/piston/execute",
          {
            language: lang,
            source: source,
          }
        );
        const { ran, language, output, version, code, message } = response.data;
        const reply = `${
          ran ? "Ran" : "Error running"
        } with ${language} v${version}\nOutput:\n${output}`;
        cl.sendText(chatId, reply);
      } catch (e) {
        console.log(e);
        cl.sendText(chatId, "Unsupported language");
      }
    } else if (message.body.startsWith("#join https://chat.whatsapp.com/")) {
      await cl.joinGroupViaLink(message.body);
      await cl.reply(message.chatId, "Joined group", message.id);
    } else if (message.body.toLowerCase() === "#nospam") {
      await cl.reply(
        message.chatId,
        "Add #nospam in group description",
        message.id
      );
    } else if (message.isGroupMsg && message.body.toLowerCase() === "#leave") {
      const user = message.chat.groupMetadata.participants.find(
        (pat) => pat.id === message.author
      );
      if (user && user.isAdmin) {
        await cl.sendText(message.chatId, leaveText);
        await cl.leaveGroup(message.chat.id);
      } else {
        await cl.reply(message.chatId, "You're not an admin!", message.id);
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
    message.type === "image" &&
      (await cl.sendImageAsSticker(message.chatId, dataUrl, message.id));
    message.type === "video" &&
      (await cl.sendMp4AsSticker(message.chatId, dataUrl));
  }
}

/**
 * Add message to process queue
 */
const processMessage = (message) =>
  queue.add(async () => {
    try {
      await procMess(message);
    } catch (e) {
      console.log(e);
    }
  });

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
