# wa-automation

Whatsapp automation weekend project

## How to deploy

1. Fork this repo.
2. Create a account on heroku and create a new app.
3. Goto Settings tab > Build packs and add following ones:
   https://github.com/jontewks/puppeteer-heroku-buildpack.git
   https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
4. If you want to customize commands do it now as you will have to scan qr again after changing. Read customization below. To set config vars go to Settings tab > Config vars > Reveal Config vars
5. Then go to Deploy tab and select Github. Connect your github account and search for your fork and click Deploy Branch.
6. Click on more on top right and select view Logs.
7. Let it build and start. Watch the logs for a qr code and scan it in whatsapp web of the number on which you want the bot on.
8. The bot will start after you scan the qr code send a message on bot number and test, NOTE: if you send message with command it wont work only commands in recived messages work
9. Go to https://console.cron-job.org/ Sign up and add the url of your bot there with execution time every 30 minutes to keep it alive

## Customization:

Set following config vars

| Name       |                Value                 |
| :--------- | :----------------------------------: |
| HELP_TEXT  | The text user gets on #help or #menu |
| LEAVE_TEXT |   The text sent in group on #leave   |

## Commands

#sticker: write in caption of a image/video/gif to turn it into sticker

#spam: tag everyone in a message in a group (only works in a group)

#join https://chat.whatsapp.com/shdkashdh: joing a group with invite link

#leave: i hope you dont use this (only works in a group if sent by an admin)

#help: To recive this same message

#menu: Same as help but some people prefer it

Add '#nospam' in group description to stop spam commands

#### Warning:

This is a simple script written mostly at night so it may break.

This is not in any way sponsored/endorsed/encouraged by zuccu
