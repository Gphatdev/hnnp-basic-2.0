const fs = require("fs-extra");
const path = require("path");

const junkFilePattern = /^(image|video)_\d+\.(jpg|jpeg|png|gif|mp4|webm|mov)$/i;
const temporaryFilePattern = /\.(tmp|temp|part|download|crdownload)$/i;

function cleanupDirectory(directory) {
    if (!fs.existsSync(directory)) return { files: 0, directories: 0 };

    let removedFiles = 0;
    let removedDirectories = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const result = cleanupDirectory(entryPath, false);
            removedFiles += result.files;
            removedDirectories += result.directories;
            if (fs.readdirSync(entryPath).length === 0) {
                fs.removeSync(entryPath);
                removedDirectories++;
            }
            continue;
        }

        if (junkFilePattern.test(entry.name) || temporaryFilePattern.test(entry.name)) {
            fs.removeSync(entryPath);
            removedFiles++;
        }
    }

    return { files: removedFiles, directories: removedDirectories };
}

module.exports = function cleanupStartupFiles(rootDirectory, logger) {
    const cacheDirectories = [
        path.join(rootDirectory, "modules", "commands", "cache"),
        path.join(rootDirectory, "modules", "events", "cache")
    ];
    const totals = cacheDirectories.reduce((total, directory) => {
        const result = cleanupDirectory(directory);
        return {
            files: total.files + result.files,
            directories: total.directories + result.directories
        };
    }, { files: 0, directories: 0 });

    if (totals.files || totals.directories) {
        logger(`Đã dọn ${totals.files} file và ${totals.directories} thư mục tạm.`, "[ CLEANUP ] >");
    }
};