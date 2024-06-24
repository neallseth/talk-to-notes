import { spawnSync } from "bun";
import path from "path";

// Path to your AppleScript file
const notesExportScriptPath = path.join(import.meta.dir, "export_notes.scpt");
const calExportScriptPath = path.join(import.meta.dir, "export_cal.scpt");
// Path to the export directory
const notesExportDir = path.join(import.meta.dir, "../notes/raw");
const calExportDir = path.join(import.meta.dir, "../cal/raw");

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
  const result = spawnSync(["osascript", calExportScriptPath, calExportDir]);

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString();

  if (stderr) {
    console.error(`Error: ${stderr}`);
  } else {
    console.log(`Success! Exported ${stdout} events.`);
  }
}

exportNotes();
exportCal();
