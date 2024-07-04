import inquirer from "inquirer";
import chalk from "chalk";
import type { CoreMessage } from "ai";
import { getUseModel } from "@/utils/tensorflow";
import { HierarchicalNSW } from "hnswlib-node";
import { embedText } from "@/utils/tensorflow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { type EmbeddingEntry, type FormattedEvent } from "@/types";
import type { UniversalSentenceEncoder } from "@tensorflow-models/universal-sentence-encoder";
import { getFormattedDate } from "@/utils/misc";

export async function getSearchableQuery(query: string) {
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
        What follows is the query from the user in its original format. Please provide only the reformatted query, without any additional information, context, or words. 
        Alternatively, if the query appears to be a follow-up of a previous question, (e.g., "why do you think that is?") simply respond with 'follow-up', since there would be no need to find relevant notes.`,
      },
      { role: "user", content: query },
    ],
  });
  return text;
}

export async function getFilteringCriteria(query: string) {
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
          For example, if the user queries about their notes from july '23, the correct response would be 'noteDate:July&&noteDate:2023'. If it were June 2024, and the user asked about notes from the last month, the correct filter criteria would be 'noteDate:May&&noteDate:2024'. If they query about a specific date, add the number after the month, like 'noteDate:July 23&&noteDate:2023'.
          Given the available folders, you can also provide a filter criteria specifying one of these folders, if it is likely to contain relevant notes. For example, if the user asks about their work, the correct response would be 'folder:Work', if asking about friends, perhaps 'folder:Social'.
          You can also combine these - if the user asks about their travels this year, the correct response would be 'folder:Travel&&noteDate:2024'.
          The current date is: ${getFormattedDate()}
          The next thing you see is the query from the user - your job is only to provide filtering criteria if relevant, not to answer the question itself. If no filtering criteria seems relevant, respond with 'none'. Do not respond with any words other than the filtering criteria, or 'none'
          `,
      },
      { role: "user", content: query },
    ],
  });

  // Assuming the response text contains a list of relevant keywords or phrases separated by commas
  return text.split("&&").map((condition) => condition.trim());
}

export async function getFilteredIndices(
  entries: EmbeddingEntry[],
  filteringCriteria: string[]
) {
  if (filteringCriteria.length === 1 && filteringCriteria[0] === "none") {
    return null;
  }

  const filteredIndices = new Set<number>();

  entries.forEach((entry) => {
    const isRelevant = filteringCriteria.every((criteria) => {
      const [property, value] = criteria.split(":");
      if (property === "noteDate") {
        return entry[property].includes(value);
      }
      if (property === "folder") {
        return entry[property] === value;
      }

      console.warn(`Unsupported property: ${property}`);
      return true;
    });

    if (isRelevant) {
      filteredIndices.add(entry.id);
    }
  });

  return filteredIndices;
}

export function getFilteredEvents(
  events: FormattedEvent[],
  filteringCriteria: string[],
  maxEvents: number
) {
  if (filteringCriteria.length === 1 && filteringCriteria[0] === "none") {
    return [];
  }

  return events
    .filter((event) => {
      return filteringCriteria.every((criteria) => {
        const [property, value] = criteria.split(":");
        if (property === "noteDate") {
          return event.date.includes(value);
        }
        return true;
      });
    })
    .slice(0, maxEvents);
}

// Create a filter function for k-NN search
export function genKnnFilter(targetIndices: Set<number> | null) {
  if (!targetIndices) {
    return () => true;
  } else {
    return (index: number) => targetIndices.has(index);
  }
}

export function assemblePrompt(
  query: string,
  noteIndices: number[],
  notes: EmbeddingEntry[],
  events: FormattedEvent[]
) {
  let prompt = `
Query: ${query}
`;

  if (noteIndices.length > 0) {
    prompt += `\nPotentially relevant notes from user's notes app: `;
    for (let idx of noteIndices) {
      prompt += `\n- ${notes[idx].chunk}`;
    }
  }

  if (events.length > 0) {
    prompt += `\n\nPotentially relevant events from user's calendar: `;

    for (let event of events) {
      prompt += `\n- "${event.name}" on ${event.date}, link: ${event.link}`;
    }
  }

  return prompt;
}

export async function generateResponse(
  prompt: string,
  chatMessages: CoreMessage[]
) {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const result = await streamText({
    model: groq("llama3-70b-8192"),
    messages: [
      {
        role: "system",
        content: `You are helping the user with their queries based on context from their notes and calendar entries. You will receive their query followed by relevant context. This will be a chat-style conversation - respond helpfully without follow-up questions. The current date is: ${getFormattedDate()}`,
      },
      ...chatMessages,
    ],
  });

  let queryResponse = "";
  for await (const delta of result.textStream) {
    queryResponse += delta;
    process.stdout.write(delta);
  }
  return queryResponse;
}
