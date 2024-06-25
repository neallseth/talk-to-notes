import fs from "fs";
import path from "path";
import { chunkText, parseMarkdown } from "../utils/text-processing";
import { embedText, getUseModel } from "../utils/tensorflow";
import { HierarchicalNSW } from "hnswlib-node";
import { file } from "bun";
import { type EmbeddingEntry } from "@/types";
import { unlinkSync } from "node:fs";

const NOTES_DIR = "./notes/raw";
const EMBEDDINGS_FILE = "embeddings.json";
const EMBEDDINGS_INDEX = "index.dat";
const CHUNK_SIZE = 150;
const OVERLAP_SIZE = 15;

// Function to read all markdown files recursively
const getFilePaths = (dir: string): string[] => {
  let files: string[] = [];
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getFilePaths(fullPath));
    } else if (fullPath.endsWith(".txt")) {
      files.push(fullPath);
    }
  });

  return files;
};

function getMetadataFromFilepath(filePath: string) {
  const splitPath = filePath.replace(".txt", "").split("/");
  const folder = splitPath.at(-2) || "";
  const fileName = splitPath.at(-1);
  const noteName = fileName?.split(" -- ")[0] || "";
  const noteDate = fileName?.split(" -- ")[1] || "";

  return { folder, noteName, noteDate };
}

const getContextualizedChunk = (chunk: string, filePath: string) => {
  const { folder, noteName, noteDate } = getMetadataFromFilepath(filePath);

  return `From note titled '${noteName}' last modified ${noteDate}, in the '${folder}' folder: ${chunk}`;
};

const getEmbeddings = async () => {
  const model = await getUseModel();
  const filePaths: string[] = getFilePaths(NOTES_DIR);
  const embeddings: EmbeddingEntry[] = [];
  let id = 0;

  for (const filePath of filePaths) {
    const { folder, noteName, noteDate } = getMetadataFromFilepath(filePath);
    try {
      const timeStart = performance.now();
      const noteContent: string = fs.readFileSync(filePath, "utf-8");
      const chunks: string[] = chunkText(noteContent, CHUNK_SIZE, OVERLAP_SIZE);
      for (const chunk of chunks) {
        const contextualizedChunk = getContextualizedChunk(chunk, filePath);
        const embedding: number[] = await embedText(contextualizedChunk, model);
        embeddings.push({
          id: id++,
          chunk: contextualizedChunk,
          embedding,
          folder,
          noteName,
          noteDate,
        });
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
    // Cleanup previous embeddings
    if (await Bun.file(EMBEDDINGS_FILE).exists()) {
      unlinkSync(EMBEDDINGS_FILE);
    }
    if (await Bun.file(EMBEDDINGS_INDEX).exists()) {
      unlinkSync(EMBEDDINGS_INDEX);
    }

    console.log("Beginning embedding...");
    const timeStart = performance.now();
    const embeddings = await getEmbeddings();
    await Bun.write(EMBEDDINGS_FILE, JSON.stringify(embeddings));
    const index = new HierarchicalNSW("cosine", 512);
    index.initIndex(embeddings.length);

    embeddings.forEach((entry, i) => {
      index.addPoint(entry.embedding, entry.id);
    });

    index.writeIndexSync(EMBEDDINGS_INDEX);
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
