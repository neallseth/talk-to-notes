import "./misc/TextStreamPolyfill"; // Can remove once this closes: https://github.com/oven-sh/bun/issues/5648

import inquirer from "inquirer";
import chalk from "chalk";
import type { CoreMessage } from "ai";
import { getUseModel } from "@/utils/tensorflow";
import { HierarchicalNSW } from "hnswlib-node";
import { embedText } from "@/utils/tensorflow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { type EmbeddingEntry } from "@/types";
import type { UniversalSentenceEncoder } from "@tensorflow-models/universal-sentence-encoder";
import { getFormattedDate } from "@/utils/misc";
import {
  assemblePrompt,
  genKnnFilter,
  generateResponse,
  getFilteredIndices,
  getFilteringCriteria,
  getSearchableQuery,
} from "./query";

class ChatHistory {
  private messages: CoreMessage[];
  private maxMessages: number;

  constructor(maxMessages = 3) {
    this.messages = [];
    this.maxMessages = maxMessages;
  }

  addMessage(role: "user" | "assistant", content: string) {
    if (this.messages.length >= this.maxMessages) {
      this.messages.shift();
    }
    const message: CoreMessage = { role, content };
    this.messages.push(message);
  }

  getMessages(): CoreMessage[] {
    return [...this.messages];
  }
}

export async function getPrompt(
  query: string,
  useModel: UniversalSentenceEncoder,
  index: HierarchicalNSW,
  notes: EmbeddingEntry[]
) {
  const [vectorSearchQuery, filteringCriteria] = await Promise.all([
    getSearchableQuery(query),
    getFilteringCriteria(query),
  ]);

  console.log({ vectorSearchQuery, filteringCriteria });

  const [embeddedQuery, relevantIndices] = await Promise.all([
    embedText(vectorSearchQuery, useModel),
    getFilteredIndices(notes, filteringCriteria),
  ]);

  // Retrieve nearest neighbors and stored notes
  const neighborIndicesStart = performance.now();
  const neighborIndices = index.searchKnn(
    embeddedQuery,
    10,
    genKnnFilter(relevantIndices)
  ).neighbors;
  console.log({ neighborIndices });
  console.log("neighborIndicesTime:", performance.now() - neighborIndicesStart);

  // Generate prompt and run inference
  return assemblePrompt(query, neighborIndices, notes);
}

async function chat() {
  const chatMessages = new ChatHistory();

  // Load notes
  const notesLoadStart = performance.now();
  const notes = (await Bun.file("embeddings.json").json()) as EmbeddingEntry[];
  console.log("notesLoadTime:", performance.now() - notesLoadStart);

  // Load vector index
  const readIndexStart = performance.now();
  const index = new HierarchicalNSW("cosine", 512);
  await index.readIndex("index.dat");
  console.log("loadIndexTime:", performance.now() - readIndexStart);

  // Load Universal Sentence Encoder model
  const modelLoadStart = performance.now();
  const useModel = await getUseModel();
  console.log("modelLoadTime:", performance.now() - modelLoadStart);

  console.log(
    chalk.magenta(
      "You're chatting with Apple Notes! Simply type a query, or say 'exit' or 'help'"
    )
  );

  while (true) {
    const { userInput: rawInput } = await inquirer.prompt([
      {
        type: "input",
        name: "userInput",
        message: chalk.green("You:"),
        prefix: "",
      },
    ]);

    const input = rawInput.trim().toLowerCase();

    if (input === "exit" || input === "quit") {
      console.log(chalk.magenta("Goodbye!"));
      break;
    }

    if (input.toLowerCase() === "help") {
      console.log(chalk.magenta("Available commands:"));
      console.log(chalk.magenta("help - Show this help message"));
      console.log(chalk.magenta("exit - Exit the chat"));
      continue;
    }

    const getPromptStart = performance.now();
    const prompt = await getPrompt(input, useModel, index, notes);
    chatMessages.addMessage("user", prompt);

    console.log("getPromptTime:", performance.now() - getPromptStart);

    process.stdout.write(chalk.blue(`Apple Notes: `));

    const generateResponseStart = performance.now();
    const queryResponse = await generateResponse(
      prompt,
      chatMessages.getMessages()
    );
    console.log(
      "\ngenerateResponseTime:",
      performance.now() - generateResponseStart
    );
    chatMessages.addMessage("assistant", queryResponse);
    console.log(`\n`);
  }
}

await chat();
