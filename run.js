const child_process = require('child_process');
const fs = require('fs');
const readline = require('readline');

/**
 * @param {string} env 
 * @param {index} i 
 */
function procStart(env, i) {
    let [envInd, start, asIndStr] = env.split(':');
    let asInd = parseInt(asIndStr);
    if (Number.isSafeInteger(asInd) && asInd >= 0) {
        if (procList[i] && !procList[i].killed) procList[i].kill();
        i = asInd;
    }
    let path = `envs/env${envInd}`;
    let args = ['bruteForce.js'];
    if (start) args.push(start);
    console.log(`Starting env ${envInd}`, args);
    let proc = child_process.spawn('node', args, {cwd: path, stdio: 'pipe', shell: true});
    proc.on('exit', () => {
        console.log(`[${new Date().toISOString()}] Process ${i} (started with ${env}) ended`);
        if (procList.every(v => !v || v.killed)) process.exit(0);
    });
    proc.stdout.pipe(fs.createWriteStream(`${path}/stdout.txt`));
    proc.stderr.pipe(fs.createWriteStream(`${path}/stderr.txt`));
    procList[i] = proc;
}

let envs = process.argv.slice(2);
let procList = [];
envs.forEach(procStart);

let interface = readline.createInterface(process.stdin);
interface.on('line', inp => {
    let [command, ...indexes] = inp.split(' ');
    switch (command) {
        case 'kill':
            let killList = indexes.map(v => parseInt(v)).filter(v => Number.isSafeInteger(v) && v >= 0);
            for (let ind of killList) {
                console.log(ind);
                try {
                    procList[ind].kill();
                } catch (err) {
                    console.error(err);
                }
            }
            break;
        case 'start':
            // procList.push(...indexes.map((v, i) => procStart(v, i + procList.length)));
            indexes.forEach((v, i) => procStart(v, i + procList.length));
            break;
        case 'killall':
            procList.forEach(v => {
                if (v && !v.killed) v.kill();
            });
            break;
        case 'help':
            console.log('Available commands:\n`kill [...processIndexes]`\n`killall`\n`start [...(processIndex[:processStartInd])]`');
            break;
    }
});

