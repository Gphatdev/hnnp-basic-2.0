const { spawn } = require("child_process");
const logger = require("./utils/log");
const MAX_RESTARTS = 5;
global.countRestart = 0;

function startBot(message) {
    (message) ? logger(message, "[ Starting ]") : "";
    const child = spawn("node", ["--trace-warnings", "--async-stack-traces", "mirai.js"], {
        cwd: __dirname,
        stdio: "inherit",
    });
    child.on("close", (codeExit) => {
        if (codeExit === 0) return;
        if (global.countRestart >= MAX_RESTARTS) {
            logger("Maximum restart attempts reached.", "[ Starting ]");
            process.exitCode = codeExit || 1;
            return;
        }
        global.countRestart += 1;
        startBot(`Restarting (${global.countRestart}/${MAX_RESTARTS})...`);
    });

    child.on("error", function (error) {
        logger("An error occurred: " + JSON.stringify(error), "[ Starting ]");
    });
};
startBot();