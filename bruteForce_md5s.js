// Must be run with Node.js 18, using `node bruteForce.js`
// https://nodejs.org/en/download/current/

const fs = require('fs');

const {
    WEBHOOK_URL,
    challenge_id,
    radford_headers,
    time_after_incorrect,
    time_after_ratelimit
} = require('./config.json');

async function submit(challenge_id, submission) {
    let res = await fetch("https://rusecurectf.radford.edu/api/v1/challenges/attempt", {
        "headers": radford_headers,
        "body": JSON.stringify({challenge_id, submission}),
        "method": "POST"
    });

    if (!res.status.toString().startsWith('2')) return 'ratelimited';
    let d = await res.json();
    if (d?.data?.status === 'incorrect') return 'incorrect';
    console.log(d);
    return 'done';
}

async function handleFetch(req) {
    try {
        await req;
    } catch (err) {
        console.error(err);
        let str = `\n[${new Date().toISOString()}] Error when trying to send webhook message:\n${err.stack}\n`;
        if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
        bruteForceLog.write(str + '\n');
    }
}

let bruteForceLog = fs.createWriteStream('bruteForceLog_md5s.txt');
(async () => {
    console.log('65536 total');
    let initialNum = +process.argv[2] || 0;

    for (let i = initialNum; i < 0xffff; i++) {
        let s = i.toString(16).padStart(4, '0');
        console.log(`string: ${s}, index: ${i}`);

        let res = 'ratelimited';
        try {
            res = await submit(challenge_id, s);
        } catch (err) {
            console.error(err);
            let str = `\n[${new Date().toISOString()}] Error submitting answer:\n${err.stack}\n`;
            if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
            bruteForceLog.write(str + '\n');
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `<@370287366834880512> <@600010784453558331>: Error\nChallenge ID: ${challenge_id}\nIndex: ${i}\nString: ${s}\nError: \`\`\`js\n${err.stack}\n\`\`\``
                })
            }));
        }
        if (res === 'ratelimited') {
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `<@370287366834880512> <@600010784453558331>: Ratelimited\nChallenge ID: ${challenge_id}\nIndex: ${i}\nString: ${s}`
                })
            }));
        }

        console.log(res);
        bruteForceLog.write(`string: ${s}, index: ${i}, response: ${res}\n`);
        if (res !== 'done') await new Promise(resolve => setTimeout(() => resolve(), res === 'incorrect' ? time_after_incorrect : time_after_ratelimit));
        else break;

        if (i % 100 === 0) {
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `Routine update:\nChallenge ID: ${challenge_id}\nIndex: ${i}\nString: ${s}`
                })
            }));
        }

        if (res === 'ratelimited') i--;
    }
    bruteForceLog.close();
})();
