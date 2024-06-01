import fs from "fs";
import path from "path";
import { chunkText, parseMarkdown } from "../utils/text-processing";
import { embedText, getUseModel } from "../utils/tensorflow";
import { HierarchicalNSW } from "hnswlib-node";
import { file } from "bun";

const NOTES_DIR = "./notes/markdown";
const EMBEDDINGS_FILE = "embeddings.json";
const CHUNK_SIZE = 150;
const OVERLAP_SIZE = 15;

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

const getContextualizedChunk = (chunk: string, filePath: string) => {
  const splitPath = filePath.replace(".md", "").split("/");
  const folder = splitPath.at(-2);
  const fileName = splitPath.at(-1);
  const noteName = fileName?.split(" -- ")[0];
  const noteDate = fileName?.split(" -- ")[1];

  return `From my note titled '${noteName}' created ${noteDate}, in the '${folder}' folder: ${chunk}`;
};

const getEmbeddings = async () => {
  const model = await getUseModel();
  const filePaths: string[] = readMarkdownFiles(NOTES_DIR);
  const embeddings: EmbeddingEntry[] = [];

  for (const filePath of filePaths) {
    try {
      const timeStart = performance.now();
      const noteContent: string = fs.readFileSync(filePath, "utf-8");
      const parsedText: string = parseMarkdown(noteContent);
      const chunks: string[] = chunkText(parsedText, CHUNK_SIZE, OVERLAP_SIZE);
      for (const chunk of chunks) {
        const contextualizedChunk = getContextualizedChunk(chunk, filePath);
        const embedding: number[] = await embedText(contextualizedChunk, model);
        embeddings.push({ chunk: contextualizedChunk, embedding });
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
    await Bun.write(EMBEDDINGS_FILE, JSON.stringify(embeddings));
    const index = new HierarchicalNSW("cosine", 512);
    index.initIndex(embeddings.length);

    embeddings.forEach((entry, i) => {
      index.addPoint(entry.embedding, i);
    });

    index.writeIndexSync("index.dat");
    const timeEnd = performance.now();
    console.log(
      "Time taken to embed notes:",
      Math.ceil((timeEnd - timeStart) / 1000),
      "seconds"
    );
  } catch (err) {
    console.error("Error embedding notes:", err);
  }
}
await embedAndStore();
