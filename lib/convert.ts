import { promises as fs } from "fs";
import * as path from "path";
import TurndownService from "turndown";
import { ensureDir, outputFile } from "fs-extra";

// Initialize Turndown Service
const turndownService = new TurndownService();

// Define the source and destination directories
const srcDir = "../notes/raw";
const destDir = "../notes/markdown";

// Function to sanitize the content by removing unusual line terminators
function sanitizeContent(content: string): string {
  return content.replace(/[\u2028\u2029]/g, "");
}

// Function to preprocess HTML content by replacing <br> tags with newlines
function preprocessHTML(content: string): string {
  return content.replace(/<br\s*\/?>/gi, "\n");
}

// Function to clean up extra spaces and blank lines in Markdown content
function cleanUpMarkdown(content: string): string {
  // Remove multiple consecutive blank lines
  return content.replace(/\n{3,}/g, "\n\n").trim();
}

// Function to convert HTML files to Markdown and save them
async function convertFiles(src: string, dest: string) {
  try {
    // Read the directory
    const items = await fs.readdir(src, { withFileTypes: true });

    // Iterate through each item in the directory
    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      if (item.isDirectory()) {
        // If the item is a directory, create the corresponding directory in the destination
        await ensureDir(destPath);
        // Recursively convert files in the subdirectory
        await convertFiles(srcPath, destPath);
      } else if (item.isFile() && item.name.endsWith(".txt")) {
        // If the item is a file with a .txt extension, read and convert it
        const htmlContent = await fs.readFile(srcPath, "utf-8");
        // Sanitize the content
        const sanitizedContent = sanitizeContent(htmlContent);
        // Preprocess the HTML content
        const preprocessedContent = preprocessHTML(sanitizedContent);
        const markdownContent = turndownService.turndown(preprocessedContent);
        // Clean up the Markdown content
        const cleanedMarkdownContent = cleanUpMarkdown(markdownContent);
        const newFileName = item.name.replace(".txt", ".md");
        const newFilePath = path.join(dest, newFileName);
        // Save the converted content to the new file in the destination directory
        await outputFile(newFilePath, cleanedMarkdownContent);
      }
    }
  } catch (err) {
    console.error(`Error converting files: ${err}`);
  }
}

// Start the conversion process
convertFiles(srcDir, destDir)
  .then(() => console.log("Conversion complete"))
  .catch((err) => console.error(`Error during conversion: ${err}`));
