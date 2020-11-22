const wa = require("@open-wa/wa-automate");
const { create, decryptMedia } = wa;
const { default: PQueue } = require("p-queue");
const fs = require("fs");

/**
 * WA Client
 * @type {null | import("@open-wa/wa-automate").Client}
 */
let cl = null;
const queue = new PQueue({
  concurrency: 4,
  autoStart: false,
});

/**
 * Process the message
 * @param {import("@open-wa/wa-automate").Message} message
 */
async function procMess(message) {
  console.log(message);
  if (message.type === "chat") {
    if (message.body.toLowerCase().startsWith("ayy")) {
      await cl.sendText(message.from, "ayy mofo");
    } else if (message.body.includes("https://chat.whatsapp.com/")) {
      await cl.joinGroupViaLink(message.body);
      await cl.sendText(message.chatId, "Joined group");
    }
  } else if (message.type === "image" && message.caption === "#sticker") {
    await cl.sendText(message.chatId, "Processing image");
    const mediaData = await decryptMedia(message);
    const dataUrl = `data:${message.mimetype};base64,${mediaData.toString(
      "base64"
    )}`;
    await cl.sendImageAsSticker(message.chatId, dataUrl);
    await cl.sendText(message.chatId, "Here is your sticker");
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

create().then((client) => start(client));

process.on("exit", () => {
  fs.unlinkSync("./session.data.json");
});
