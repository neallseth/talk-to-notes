import { HierarchicalNSW } from "hnswlib-node";
import { getUseModel, embedText } from "../utils/tensorflow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { type EmbeddingEntry } from "../types";

const notes = await Bun.file("embeddings.json").json();

async function getSearchableQuery(query: string) {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const { text } = await generateText({
    model: groq("llama3-8b-8192"),
    messages: [
      {
        role: "system",
        content: `You are helping the user reformat their query to make it more suitable for searching through their notes. 
        The notes are stored as embeddings, and similarity search will be used to find relevant notes based on the embedded version of the query you provide.
        Therefore, it is important that you provide a query that is likely to have maximally similar embedding to the notes the user is looking for. 
        What follows is the query from the user in its original format. Please provide only the reformatted query, without any additional information, context, or words.`,
      },
      { role: "user", content: query },
    ],
  });
  return text;
}

async function getFilteringCriteria(query: string) {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const { text } = await generateText({
    model: groq("llama3-8b-8192"),
    messages: [
      {
        role: "system",
        content: `You are helping the user filter a list of notes based on their query. Your goal is to provide a filter criteria, to help them find relevant notes. 
          The notes are stored in a JSON array, and each object (representing a note) has the following properties: 'noteDate' (example value: 'Thursday, March 14, 2024'), and 'folder' (possible values: 'Work', 'Social', 'Technical', 'Travel', 'Health', 'Writing'). Please respond with a filter criteria in the following format: '<property_name>:<filter_value>'. You may chain multiple necessary filters using '&&'.
          For example, if the user queries about their notes from july '23, the correct response would be 'noteDate:July&&noteDate:2023'. It is currently June 2024, so if the user asks about notes from the last month, the correct filter criteria would be 'noteDate:May&&noteDate:2024'.
          Given the available folders, you can also provide a filter criteria specifying one of these folders, if it is likely to contain relevant notes. For example, if the user asks about their work, the correct response would be 'folder:Work', if asking about friends, perhaps 'folder:Social'.
          You can also combine these - if the user asks about their travels this year, the correct response would be 'folder:Travel&&noteDate:2024'.
          The next thing you see is the query from the user - your job is only to provide filtering criteria if relevant, not to answer the question itself. If no filtering criteria seems relevant, respond with 'none'. Do not respond with any words other than the filtering criteria, or 'none'`,
      },
      { role: "user", content: query },
    ],
  });

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
        if (property === "folder") {
          return entry[property] === value;
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

  // Get filtering criteria from LLM
  const filteringCriteria = await getFilteringCriteria(query);
  console.log({ filteringCriteria });

  // Get reformatted, searchable query
  const vectorSearchQuery = await getSearchableQuery(query);
  console.log({ vectorSearchQuery });

  // Embed query
  const embeddedQuery = await embedText(vectorSearchQuery, await getUseModel());

  // Filter relevant indices
  const relevantIndices = await getFilteredIndices(notes, filteringCriteria);

  // Retrieve nearest neighbors and stored notes
  const neighborIndices = index.searchKnn(
    embeddedQuery,
    10,
    genKnnFilter(relevantIndices)
  ).neighbors;
  console.log({ neighborIndices });

  // Generate prompt and run inference
  const prompt = await genPrompt(query, neighborIndices, notes);
  console.log({ prompt });

  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const { text } = await generateText({
    model: groq("llama3-70b-8192"),
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
