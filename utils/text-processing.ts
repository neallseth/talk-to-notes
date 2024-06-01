import { marked } from "marked";
import { decode } from "html-entities";

export const parseMarkdown = (markdown: string) => {
  // Strip images from markdown
  const cleanedMarkdown = markdown.replace(/!\[.*?\]\(.*?\)/g, "");

  // Parse to HTML
  const html = marked.parse(cleanedMarkdown) as string;

  // Remove HTML tags and decode HTML entities to get plain text
  return decode(html.replace(/<\/?[^>]+(>|$)/g, ""));
};

export const chunkText = (
  document: string,
  size: number,
  overlap: number
): string[] => {
  const words = document.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ");
    chunks.push(chunk);
  }

  return chunks;
};
