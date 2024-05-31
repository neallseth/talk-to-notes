import { marked } from "marked";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import * as tf from "@tensorflow/tfjs-node"; // Ensure the Node.js backend is registered

export const parseMarkdown = (markdown: string) => {
  // Strip images from markdown
  const cleanedMarkdown = markdown.replace(/!\[.*?\]\(.*?\)/g, "");

  // Parse to HTML
  const html = marked.parse(cleanedMarkdown) as string;

  // Remove HTML tags to get plain text
  const plainText = html.replace(/<\/?[^>]+(>|$)/g, "");

  return plainText;
};

export const chunkText = (
  text: string,
  size: number,
  overlap: number
): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

export const embedText = async (
  text: string,
  model: use.UniversalSentenceEncoder
): Promise<number[]> => {
  const embeddings = await model.embed([text]);
  return embeddings.arraySync()[0];
};
