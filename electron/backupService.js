const fs = require("fs");
const path = require("path");

const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_BACKUPS = 5;

let lastBackup = Date.now();

function ensureBackupFolder(backupDir) {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
}

function timestamp() {
    const d = new Date();

    const pad = n => String(n).padStart(2, "0");

    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Returns only backups created by this service.
 *
 * Example:
 * backup-08-09_13-00-00.db
 */
function getBackupFiles(backupDir) {
    return fs.readdirSync(backupDir)
        .filter(name =>
            /^backup-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name)
        )
        .map(name => ({
            name,
            path: path.join(backupDir, name),
            time: fs.statSync(path.join(backupDir, name)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
}

/**
 * Keeps only the newest MAX_BACKUPS backup files.
 */
function cleanupOldBackups(backupDir) {
    const backups = getBackupFiles(backupDir);

    const oldBackups = backups.slice(MAX_BACKUPS);

    for (const backup of oldBackups) {
        try {
            fs.unlinkSync(backup.path);
            console.log("Deleted old backup:", backup.name);
        } catch (err) {
            console.error(
                "Could not delete old backup:",
                backup.name,
                err.message
            );
        }
    }
}

/**
 * Removes files that do not belong in the dedicated backup folder.
 *
 * This includes SQLite sidecar files such as:
 * .db-wal
 * .db-shm
 *
 * The backup folder must NOT be used as a live database folder.
 */
function cleanupUnwantedFiles(backupDir) {
    const files = fs.readdirSync(backupDir);

    for (const name of files) {
        if (/^backup-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name)) {
            continue;
        }

        const filePath = path.join(backupDir, name);

        try {
            const stat = fs.statSync(filePath);

            if (stat.isFile()) {
                fs.unlinkSync(filePath);
                console.log("Removed unwanted backup-folder file:", name);
            }
        } catch (err) {
            console.error(
                "Could not remove backup-folder file:",
                name,
                err.message
            );
        }
    }
}

async function performBackup(db, backupDir) {
    ensureBackupFolder(backupDir);

    const backupPath = path.join(
        backupDir,
        `backup-${timestamp()}.db`
    );

    try {
        // Create a standalone SQLite backup.
        await db.backup(backupPath);

        lastBackup = Date.now();

        // Remove anything that isn't one of our backup files.
        cleanupUnwantedFiles(backupDir);

        // Keep only the newest 5 backups.
        cleanupOldBackups(backupDir);

        console.log("Database backed up:", backupPath);

    } catch (err) {
        // If the backup failed, don't update lastBackup.
        console.error("Database backup failed:", err);
    }
}

async function hourlyCheck(db, backupDir) {
    if (Date.now() - lastBackup >= BACKUP_INTERVAL_MS) {
        await performBackup(db, backupDir);
    }
}

module.exports = {
    hourlyCheck,
    performBackup
};