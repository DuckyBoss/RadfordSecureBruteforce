const Eris = require('eris');
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');

const config = require('./config.json');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
/** Log file */
let botLogs = fs.createWriteStream('logs/botLogs.txt');

/** @type {child_process.ChildProcessWithoutNullStreams | undefined} */
let runner = undefined;
function initEnvRunner() {
   runner = child_process.spawn('node', ['run.js'], {stdio: 'pipe'});
   runner.stdout.pipe(fs.createWriteStream('logs/stdout_log.txt'));
   runner.stderr.pipe(fs.createWriteStream('logs/stderr_log.txt'));
   runner.on('exit', () => initEnvRunner());
}
initEnvRunner();

const bot = new Eris.Client(config.TOKEN, {intents: ["allNonPrivileged", "guildMessages", "directMessages", "guildMembers"]});

bot.on('error', (err) => {
   console.error(err);
   let str = `[${new Date().toISOString()}] Error:\n${err.stack}\n`;
   if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
   botLogs.write(str);
});

/**
 * @param {string[]} indexes 
 */
function startCtf(indexes) {
   runner.stdin.write('start ' + indexes.join(' ') + '\n');
}

/**
 * @param {*} indexes 
 */
function endCtf(indexes) {
   runner.stdin.write('kill ' + indexes.join(' ') + '\n');
}
function endAllCtfs() {
   runner.stdin.write('killall\n');
   initEnvRunner();
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
            startCtf(args.slice(1));
            msg.channel.createMessage('Started given envs.');
            break;
         case '*end':
            endCtf(args.slice(1));
            msg.channel.createMessage('Ended given envs.');
            break;
         case '*endall':
            endAllCtfs();
            msg.channel.createMessage('All CTF scripts ended and the list of scripts refreshed.');
            break;

         case '*getenvs':
         case '*get-envs':
            let envs = fs.readdirSync('envs').filter(v => !v.includes('.')).map(v => v.slice(-1));
            msg.channel.createMessage(`Available envs:\n${envs.join(' | ') || 'None'}`);
            break;
         case '*ctfoutput':
         case '*ctf-output': {
            let type = args[1]?.toLowerCase();
            if (type !== 'stdout' && type !== 'stderr') {
               msg.channel.createMessage('You must specify to get either the stdout or stderr logs with the first argument.');
               break;
            }
            let env = args[2];
            if (!env) {
               msg.channel.createMessage('You must specify the env to get the log from.');
               break;
            }
            let file = `${type}.txt`;
            try {
               msg.channel.createMessage(`${type} logs from env ${env}:`, [{name: file, file: fs.readFileSync(`envs/env${env}/${file}`)}]);
            } catch {
               msg.channel.createMessage(`${file} was not found.`);
            }
            break;
         }
         case '*ctflogs':
         case '*ctf-logs': {
            let env = args[1];
            if (!env) {
               msg.channel.createMessage('You must supply an env to get the logs from.');
               break;
            }
            try {
               msg.channel.createMessage({content: 'Logs:'}, [{name: 'logs.txt', file: fs.readFileSync(`envs/env${env}/bruteForceLog.txt`)}]);
            } catch (err) {
               msg.channel.createMessage("Looks like the log file hasn't been made yet or that env doesn't exist");
            }
            break;
         }
         case '*help':
            msg.channel.createMessage('Commands:\n`*start [...indexes]`\n`*end [...indexes]`\n`*endall`\n`*ctflogs|*ctf-logs`\n`*eval [...content]`\n`*update-config entryName jsonValue`\n`*update-ctf-config env entryName jsonValue`\n`*botlogs|*bot-logs`\n`*getenvs|*get-envs`\n`*ctfoutput|*ctf-output {stdout|stderr} env`');
            break;
         case '*eval':
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            msg.channel.createMessage(util.inspect(eval(args.slice(1).join(' '))).slice(0, 2000));
            break;
         case '*update-config': {
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
            msg.channel.createMessage('Updated config file.');
            break;
         }
         case '*update-ctf-config': {
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            let [, env, paramName] = args;
            let value = null;
            try {
               value = JSON.parse(args.slice(3).join(' '));
            } catch (err) {
               msg.channel.createMessage('The second argument must be the name of the value to change and the third argument must be the JSON value to set it to. The third argument must be valid JSON.');
            }

            let path = `envs/env${env}/config.json`;
            let loadedConf = JSON.parse(fs.readFileSync(path, 'utf-8'));
            loadedConf[paramName] = value;
            fs.writeFileSync(path, JSON.stringify(loadedConf, undefined, 3));
            msg.channel.createMessage('Updated config file.');
            break;
         }
         case '*botlogs':
         case '*bot-logs':
            if (msg.author.id !== '370287366834880512' && msg.author.id !== '600010784453558331') break;
            try {
               msg.channel.createMessage({content: 'Logs:'}, [{name: 'logs.txt', file: fs.readFileSync("logs/botLogs.txt")}]);
            } catch (err) {
               msg.channel.createMessage("Looks like the log file hasn't been made yet");
            }
            break;
         case '*runnerlogs':
         case '*runner-logs':
         case '*runlogs':
         case '*run-logs':
            let type = args[1]?.toLowerCase();
            if (type !== 'stdout' && type !== 'stderr') {
               msg.channel.createMessage('You must specify to get either the stdout or stderr logs with the first argument.');
               break;
            }
            let file = `logs/${type}_log.txt`;
            try {
               msg.channel.createMessage({content: 'Logs:'}, [{name: file, file: fs.readFileSync(file)}]);
            } catch {
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
