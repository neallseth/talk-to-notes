import { spawnSync } from "bun";
import path from "path";

// Path to your AppleScript file
const appleScriptPath = path.join(import.meta.dir, "export_notes.scpt");
// Path to the export directory
const exportDir = path.join(import.meta.dir, "../notes/raw");

// Function to execute the AppleScript with a parameter
function runExportScript() {
  const result = spawnSync(["osascript", appleScriptPath, exportDir]);

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString();

  if (stderr) {
    console.error(`Error: ${stderr}`);
  } else {
    console.log(`Success! Exported ${stdout} notes.`);
  }
}

runExportScript();
