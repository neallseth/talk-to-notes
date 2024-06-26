import { spawnSync } from "bun";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import type { RawEvent } from "@/types";
import { extractUrl } from "@/utils/misc";

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

async function cleanCalExport() {
  const rawEvents = (await Bun.file(
    "./cal/raw/CalendarEvents.json"
  ).json()) as RawEvent[];

  const cleanedEvents = rawEvents.map((event) => {
    return {
      name: event.name.replace(" | Partiful", ""),
      date: event.date,
      // description: event.description,
      link: extractUrl(event.description),
    };
  });

  await Bun.write("./cal/cleaned/events.json", JSON.stringify(cleanedEvents));
}

function exportCal() {
  const result = spawnSync(["osascript", calExportScriptPath, calExportDir]);

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString();

  console.log(`stdout: ${stdout}`);
  console.log(`stderr: ${stderr}`);

  if (stderr) {
    console.error(`Error: ${stderr}`);
  } else {
    cleanCalExport();
    console.log(`Success! Exported ${stdout} calendar events.`);
  }
}

// exportNotes();
// exportCal();

cleanCalExport();
