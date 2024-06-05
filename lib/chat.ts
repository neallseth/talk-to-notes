import inquirer from "inquirer";
import chalk from "chalk";
import type { CoreMessage } from "ai";
import { getPrompt, generateResponse } from "./query";

async function chat() {
  const messages: CoreMessage[] = [];

  console.log(
    chalk.green(
      "You're chatting with Apple Notes! Simply type a query, or say 'exit' or 'help'"
    )
  );

  while (true) {
    const { userInput: rawInput } = await inquirer.prompt([
      {
        type: "input",
        name: "userInput",
        message: chalk.blue("You:"),
        prefix: "",
      },
    ]);

    const input = rawInput.trim().toLowerCase();

    if (input === "exit" || input === "quit") {
      console.log(chalk.yellow("Goodbye!"));
      break;
    }

    if (input.toLowerCase() === "help") {
      console.log(chalk.cyan("Available commands:"));
      console.log(chalk.cyan("help - Show this help message"));
      console.log(chalk.cyan("exit - Exit the chat"));
      continue;
    }

    const getPromptStart = performance.now();
    const prompt = await getPrompt(input);
    console.log("getPromptTime:", performance.now() - getPromptStart);

    console.log(chalk.magenta(`Apple Notes: `));

    const generateResponseStart = performance.now();
    await generateResponse(prompt);
    console.log(
      "generateResponseTime:",
      performance.now() - generateResponseStart
    );
    console.log(`\n`);
  }
}

chat();
