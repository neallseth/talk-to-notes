import { spawnSync } from "bun";
import path from "path";
import { existsSync, mkdirSync } from "fs";

// Path to your AppleScript file
const notesExportScriptPath = path.join(import.meta.dir, "export_notes.scpt");
const calExportScriptPath = path.join(import.meta.dir, "export_cal.scpt");
// Path to the export directory
const notesExportDir = path.join(import.meta.dir, "../notes/raw");
const calExportDir = path.join(import.meta.dir, "../cal/raw");

// Ensure export directories exist
if (!existsSync(notesExportDir)) {
  mkdirSync(notesExportDir, { recursive: true });
}

if (!existsSync(calExportDir)) {
  mkdirSync(calExportDir, { recursive: true });
}

function exportNotes() {
  const result = spawnSync([
    "osascript",
    notesExportScriptPath,
    notesExportDir,
  ]);

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString();

  if (stderr) {
    console.error(`Error: ${stderr}`);
  } else {
    console.log(`Success! Exported ${stdout} notes.`);
  }
}

function exportCal() {
  return new Promise((resolve, reject) => {
    const result = spawnSync(["osascript", calExportScriptPath, calExportDir]);

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString();

    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);

    if (stderr) {
      console.error(`Error: ${stderr}`);
      reject(stderr);
    } else {
      console.log(`Success! Exported ${stdout} calendar events.`);
      resolve(stdout);
    }
  });
}

exportNotes();
// const res = await exportCal();
