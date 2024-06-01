import { HierarchicalNSW } from "hnswlib-node";
import { getUseModel, embedText } from "../utils/tensorflow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";

const index = new HierarchicalNSW("cosine", 512);
index.readIndexSync("index.dat");

const query = "what topics do i tend to think about? please be brief";
const embeddedQuery = await embedText(query, await getUseModel());
const result = index.searchKnn(embeddedQuery, 10);
console.log(result);

const file = Bun.file("embeddings.json");

const notes = await file.json();

let prompt = `Below you will see a query from me, followed by relevant context from my notes files. Please use the context to answer my question as helpfully as possible.
Question: ${query}
Context: `;

for (let idx of result.neighbors) {
  prompt += `\n- ${notes[idx].chunk}`;
}

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const { text } = await generateText({
  model: groq("llama3-8b-8192"),
  prompt,
});
console.log(text);
