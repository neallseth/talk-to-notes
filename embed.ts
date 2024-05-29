import * as tf from "@tensorflow/tfjs-node"; // Ensure the Node.js backend is registered
import * as use from "@tensorflow-models/universal-sentence-encoder";
import fs from "fs";
import path from "path";
import { marked } from "marked";

const NOTES_DIR = "./notes/markdown";
const EMBEDDINGS_FILE = "./embeddings.json";
const CHUNK_SIZE = 512;

// Type for embeddings object
type Embeddings = { [key: string]: number[][] };

// Function to read all markdown files recursively
const readMarkdownFiles = (dir: string): string[] => {
  let files: string[] = [];
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(readMarkdownFiles(fullPath));
    } else if (fullPath.endsWith(".md")) {
      files.push(fullPath);
    }
  });

  return files;
};

// Function to chunk the text
const chunkText = (text: string, size: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

// Function to generate embeddings using Universal Sentence Encoder
const generateEmbeddings = async (
  text: string,
  model: use.UniversalSentenceEncoder
): Promise<number[]> => {
  const embeddings = await model.embed([text]);
  return embeddings.arraySync()[0];
};

// Function to parse markdown and extract plain text
const parseMarkdown = (markdown: string): string => {
  const html = marked.parse(markdown);
  const plainText = html.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
  return plainText;
};

// Main function to process notes
const processNotes = async (): Promise<void> => {
  console.log(tf.getBackend());

  const model: use.UniversalSentenceEncoder = await use.load();
  const filePaths: string[] = readMarkdownFiles(NOTES_DIR);
  const embeddings: Embeddings = {};

  for (const filePath of filePaths) {
    try {
      const noteContent: string = fs.readFileSync(filePath, "utf-8");
      const parsedText: string = parseMarkdown(noteContent);
      const chunks: string[] = chunkText(parsedText, CHUNK_SIZE);
      const noteEmbeddings: number[][] = [];
      for (const chunk of chunks) {
        const embedding: number[] = await generateEmbeddings(chunk, model);
        noteEmbeddings.push(embedding);
      }
      const noteKey = path.basename(filePath, path.extname(filePath)); // Using the file name as the key
      embeddings[noteKey] = noteEmbeddings;
    } catch (err) {
      console.error(`Error reading file: ${filePath}`, err);
    }
  }

  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
};

// Run the main function
processNotes()
  .then(() => {
    console.log("Embeddings generated and stored successfully.");
  })
  .catch((err) => {
    console.error("Error generating embeddings:", err);
  });
