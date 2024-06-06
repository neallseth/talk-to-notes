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

export async function getPrompt(
  query: string,
  useModel: UniversalSentenceEncoder,
  notes: EmbeddingEntry[]
) {
  // Load vector index
  const readIndexStart = performance.now();
  const index = new HierarchicalNSW("cosine", 512);
  await index.readIndex("index.dat");
  console.log("readIndexTime:", performance.now() - readIndexStart);

  // Get filtering criteria from LLM
  const filteringCriteriaStart = performance.now();
  const filteringCriteria = await getFilteringCriteria(query);
  console.log({ filteringCriteria });
  console.log(
    "filteringCriteriaTime:",
    performance.now() - filteringCriteriaStart
  );

  // Get reformatted, searchable query
  const vectorSearchQueryStart = performance.now();
  const vectorSearchQuery = await getSearchableQuery(query);
  console.log({ vectorSearchQuery });
  console.log(
    "vectorSearchQueryTime:",
    performance.now() - vectorSearchQueryStart
  );

  // Embed query
  const embeddedQueryStart = performance.now();
  const embeddedQuery = await embedText(vectorSearchQuery, useModel);
  console.log("embeddedQueryTime:", performance.now() - embeddedQueryStart);

  // Filter relevant indices
  const relevantIndicesStart = performance.now();
  const relevantIndices = await getFilteredIndices(notes, filteringCriteria);
  console.log("relevantIndicesTime:", performance.now() - relevantIndicesStart);

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
  const notesLoadStart = performance.now();
  const notes = await Bun.file("embeddings.json").json();
  console.log("notesLoadTime:", performance.now() - notesLoadStart);

  const messages: CoreMessage[] = [];
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
    const prompt = await getPrompt(input, useModel, notes);
    console.log("getPromptTime:", performance.now() - getPromptStart);

    process.stdout.write(chalk.blue(`Apple Notes: `));

    const generateResponseStart = performance.now();
    await generateResponse(prompt);
    console.log(
      "generateResponseTime:",
      performance.now() - generateResponseStart
    );
    console.log(`\n`);
  }
}

await chat();
