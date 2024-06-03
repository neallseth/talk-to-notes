import { HierarchicalNSW } from "hnswlib-node";
import { getUseModel, embedText } from "../utils/tensorflow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { type EmbeddingEntry } from "../types";

const notes = await Bun.file("embeddings.json").json();

async function getFilteringCriteria(query: string): Promise<string[]> {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const { text } = await generateText({
    model: groq("llama3-8b-8192"),
    messages: [
      {
        role: "system",
        content:
          "You are helping the user filter a large dataset based on their query. The dataset has entries including the following key: 'noteDate' (example value of noteDate: 'Thursday, March 14, 2024'). Please respond with a sequence (or single key-value pair) in the format '<property>:<filter_value>' chained togther with '&&' for each additional necessary filter, ONLY if necessary. For example, if the user queries about their notes from july '23, the correct response would be 'noteDate:July&&noteDate:2023'. If only the month is provided, do not assume the year. If no dates are mentioned, reply simply with a single word: 'none'",
      },
      { role: "user", content: query },
    ],
  });

  console.log({ text });

  // Assuming the response text contains a list of relevant keywords or phrases separated by commas
  return text.split("&&").map((condition) => condition.trim());
}

async function getFilteredIndices(
  entries: EmbeddingEntry[],
  filteringCriteria: string[]
): Promise<number[] | null> {
  if (filteringCriteria.length === 1 && filteringCriteria[0] === "none") {
    return null;
  }

  return entries
    .filter((entry) => {
      return filteringCriteria.every((criteria) => {
        const [property, value] = criteria.split(":");
        if (property === "noteDate") {
          return entry[property].includes(value);
        }
      });
    })
    .map((entry) => entry.id);
}

// Create a filter function for k-NN search
function genKnnFilter(targetIndices: number[] | null) {
  if (!targetIndices) {
    return () => true;
  } else {
    const indicesSet = new Set(targetIndices);
    return (index: number) => indicesSet.has(index);
  }
}

export async function handleQuery(query: string) {
  // Load vector index
  const index = new HierarchicalNSW("cosine", 512);
  await index.readIndex("index.dat");

  // Embed query
  const embeddedQuery = await embedText(query, await getUseModel());

  // Get filtering criteria from LLM
  const filteringCriteria = await getFilteringCriteria(query);

  // Filter relevant indices
  const relevantIndices = await getFilteredIndices(notes, filteringCriteria);

  // Retrieve nearest neighbors and stored notes
  const neighborIndices = index.searchKnn(
    embeddedQuery,
    10,
    genKnnFilter(relevantIndices)
  ).neighbors;

  // Generate prompt and run inference
  const prompt = await genPrompt(query, neighborIndices, notes);

  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const { text } = await generateText({
    model: groq("llama3-8b-8192"),
    messages: [
      {
        role: "system",
        content:
          "You are helping the user with their queries based on context from their notes. You will receive their query followed by relevant context. This will be a chat-style conversation.",
      },
      { role: "user", content: prompt },
    ],
  });

  return text;
}

async function genPrompt(
  query: string,
  neighbors: number[],
  notes: EmbeddingEntry[]
) {
  let prompt = `
Query: ${query}
Context: `;

  for (let idx of neighbors) {
    prompt += `\n- ${notes[idx].chunk}`;
  }

  return prompt;
}
