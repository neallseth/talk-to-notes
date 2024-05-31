import * as tf from "@tensorflow/tfjs-node"; // Ensure the Node.js backend is registered
import * as use from "@tensorflow-models/universal-sentence-encoder";
import fs from "fs";
import path from "path";
import {
  chunkText,
  embedText,
  generateEmbeddings,
  parseMarkdown,
} from "../utils/text-processing";
import { HierarchicalNSW } from "hnswlib-node";

const NOTES_DIR = "./notes/markdown";
const EMBEDDINGS_FILE = "../embeddings.json";
const CHUNK_SIZE = 512;
const OVERLAP_SIZE = 100;

// Type for embedding entry
type EmbeddingEntry = {
  chunk: string;
  embedding: number[];
};

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

// Function to generate embeddings using Universal Sentence Encoder

const getEmbeddings = async () => {
  tf.getBackend();
  const model: use.UniversalSentenceEncoder = await use.load();
  const filePaths: string[] = readMarkdownFiles(NOTES_DIR);
  const embeddings: EmbeddingEntry[] = [];

  for (const filePath of filePaths) {
    try {
      const timeStart = performance.now();
      const noteContent: string = fs.readFileSync(filePath, "utf-8");
      const parsedText: string = parseMarkdown(noteContent);
      const chunks: string[] = chunkText(parsedText, CHUNK_SIZE, OVERLAP_SIZE);
      for (const chunk of chunks) {
        const embedding: number[] = await embedText(chunk, model);
        embeddings.push({ chunk, embedding });
      }
      console.log(
        `Embedded file in ${Math.ceil(performance.now() - timeStart)}ms: `,
        filePath.split("/").at(-1)
      );
    } catch (err) {
      console.error(`Error reading file: ${filePath}`, err);
    }
  }
  return embeddings;
};

async function embedAndStore() {
  try {
    console.log("Beginning embedding...");
    const timeStart = performance.now();
    const embeddings = await getEmbeddings();
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));

    const index = new HierarchicalNSW("cosine", embeddings[0].embedding.length);
    index.initIndex(embeddings.length);

    embeddings.forEach((entry, i) => {
      index.addPoint(entry.embedding, i);
    });

    index.writeIndexSync("index.dat");
    const timeEnd = performance.now();
    console.log(
      "Time taken to embed:",
      Math.ceil((timeEnd - timeStart) / 1000),
      "seconds"
    );
  } catch (err) {
    console.error("Error embedding notes:", err);
  }
}
// Run the main function
await embedAndStore();
