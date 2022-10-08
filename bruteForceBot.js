const Eris = require('eris');
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');

const config = require('./config.json');

let botLogs = fs.createWriteStream('botLogs.txt');

const bot = new Eris.Client(config.TOKEN, {intents: ["allNonPrivileged", "guildMessages", "directMessages", "guildMembers"]});

bot.on('error', (err) => {
   console.error(err);
   let str = `[${new Date().toISOString()}] Error:\n${err.stack}\n`;
   if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
   botLogs.write(str);
});

/** @type {child_process.ChildProcess | undefined} */
let proc = undefined;

function startCtf(index) {
   if (proc && !proc.killed) proc.kill();
   let args = ["bruteForce_md5s.js"];
   if (index) args.push(index);
   proc = child_process.spawn('node', args);
   proc.once('exit', (code, signal) => botLogs.write(`[${new Date().toISOString()}] Brute force script stopped. Code ${code}, signal: ${signal}\n`));
}

function endCtf() {
   if (proc) proc.kill();
   proc = undefined;
}

bot.on('ready', () => {
   let str = `[${new Date().toISOString()}] Logged in as ${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`;
   console.log(str);
   botLogs.write(str + '\n');
}).on('disconnect', () => {
   let str = `[${new Date().toISOString()}] Disconnected`;
   console.log(str);
   botLogs.write(str + '\n');
});

bot.on('messageCreate', (msg) => {
   if (!config.BOT_USERS.includes(msg.author.id)) return;
   let args = msg.content.split(/ +/g);
   try {
      switch (args[0].toLowerCase()) {
         case '*start':
            startCtf(args[1]);
            msg.channel.createMessage('Started');
            break;
         case '*end':
            endCtf();
            msg.channel.createMessage('Ended');
            break;
         case '*ctflogs':
         case '*ctf-logs':
            try {
               msg.channel.createMessage({content: 'Logs:'}, [{name: 'logs.txt', file: fs.readFileSync("bruteForceLog_md5s.txt")}]);
            } catch (err) {
               msg.channel.createMessage("Looks like the log file hasn't been made yet");
            }
            break;
         case '*help':
            msg.channel.createMessage('Commands:\n`*start [index]`\n`*end`\n`*ctflogs|*ctf-logs`\n`*eval [...content]`\n`*update-config entryName jsonValue`\n`*botlogs|*bot-logs`');
            break;
         case '*eval':
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            msg.channel.createMessage(util.inspect(eval(args.slice(1).join(' '))).slice(0, 2000));
            break;
         case '*update-config':
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            let paramName = args[1];
            let value = null;
            try {
               value = JSON.parse(args.slice(2).join(' '));
            } catch (err) {
               msg.channel.createMessage('The first argument must be the name of the value to change and the second argument must be the JSON value to set it to. The second argument must be valid JSON.');
            }

            config[paramName] = value;
            fs.writeFileSync('config.json', JSON.stringify(config, undefined, 3));
            msg.channel.createMessage('Updated config file');
            break;
         case '*botlogs':
         case '*bot-logs':
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            try {
               msg.channel.createMessage({content: 'Logs:'}, [{name: 'logs.txt', file: fs.readFileSync("botLogs.txt")}]);
            } catch (err) {
               msg.channel.createMessage("Looks like the log file hasn't been made yet");
            }
            break;
      }
   } catch (err) {
      console.log('Error:');
      console.error(err);
      let str = `[${new Date().toISOString()}] Error:\n${err.stack}\n`;
      if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
      botLogs.write(str);
   }
});

bot.connect();

process.on('unhandledRejection', (reason) => {
   console.log('Unhandled rejection:');
   console.log(reason);
   botLogs.write(`[${new Date().toISOString()}] Unhandled rejection:\n` + reason + '\n');
});

process.on('exit', (code) => {
   botLogs.write(`[${new Date().toISOString()}] Exiting... exit code is ${code}\n`);
   botLogs.close();
});
