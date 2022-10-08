// Must be run with Node.js 18, using `node bruteForce.js`
// https://nodejs.org/en/download/current/

const fs = require('fs');

const {
    /** The url of the webhook to log to */
    WEBHOOK_URL,
    /** The id of the challenge that is being brute forced */
    challenge_id,
    /** The headers that will be sent to the Radford site. Must include token and therefore should remain private. */
    radford_headers,
    /** The time to wait in between questions */
    time_after_incorrect,
    /** The time to wait after being ratelimited or experiencing a network error */
    time_after_ratelimit
} = require('./config.json');

/**
 * Makes a submission to the given challenge with the given flag.
 * 
 * Receiving anything other than a 2XX status code will make it return "ratelimited" to be safe.
 * If it is an incorrect flag, it returns "incorrect", else "done".
 * @param {number} challenge_id 
 * @param {string} submission 
 * @returns {Promise<'ratelimited' | 'incorrect' | 'done'>}
 */
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

/**
 * Error handler for web requests using fetch
 * @param {Promise<Response>} req 
 */
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

/** Log file */
let bruteForceLog = fs.createWriteStream('bruteForceLog.txt');
(async () => {
    console.log('100,000 total');
    /** Starting number - allows the process to be stopped and started again without repeating submissions */
    let initialNum = +process.argv[2] || 0;

    for (let i = initialNum; i < 100_000; i++) {
        let str = i.toString().padStart(5, "0");
        console.log(str);

        // Assumes that it is ratelimited if it encounters a network error to give it time
        // to resolve itself
        let res = 'ratelimited';
        try {
            res = await submit(challenge_id, str);
        } catch (err) {
            console.error(err);
            let str = `\n[${new Date().toISOString()}] Error submitting answer:\n${err.stack}\n`;
            if (err.cause) str += `Error cause:\n${err.cause?.stack ?? err.cause}\n`;
            bruteForceLog.write(str + '\n');
            // Log network errors to the webhook
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `<@370287366834880512> <@600010784453558331>: Error\nChallenge ID: ${challenge_id}\nIndex: ${i}\nString: ${str}\nError: \`\`\`js\n${err.stack}\n\`\`\``
                })
            }));
        }
        if (res === 'ratelimited') {
            // Log being ratelimited to the webhook
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `<@370287366834880512> <@600010784453558331>: Ratelimited\nChallenge ID: ${challenge_id}\nIndex: ${i}\nString: ${str}`
                })
            }));
        }

        console.log(res);
        bruteForceLog.write(`string: ${str}, index: ${i}, response: ${res}\n`);
        // Wait for the necessary amount of time
        if (res !== 'done') await new Promise(resolve => setTimeout(() => resolve(), res === 'incorrect' ? time_after_incorrect : time_after_ratelimit));
        else break;

        // Log to the webhook every 200 submissions
        if (i % 200 === 0) {
            await handleFetch(fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `Routine update:\nChallenge ID: ${challenge_id}\n\nIndex: ${i}\nString: ${str}\n${"-".repeat(10)}\n${((i / 1_00000) * 100).toFixed(3)}% Completed`
                })
            }));
        }

        // Repeat submission if it didn't go through
        if (res === 'ratelimited') i--;
    }
    bruteForceLog.close();
})();
