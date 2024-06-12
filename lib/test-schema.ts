import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getFormattedDate } from "@/utils/misc";

import { z } from "zod";

export async function getFilteringCriteria(query: string) {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });

  const schema = z.object({
    criteria: z.array(
      z.object({
        property: z.string(),
        value: z.string(),
      })
    ),
    logicalOperator: z.enum(["AND", "OR"]).optional(),
  });

  const { object } = await generateObject({
    model: groq("llama3-8b-8192"),
    schema: schema,
    prompt: `You are helping the user filter a list of notes based on their query. Your goal is to provide a filter criteria, to help them find relevant notes. 
    The notes are stored in a JSON array, and each object (representing a note) has the following properties: 'noteDate' (example value: 'Thursday, March 14, 2024'), and 'folder' (possible values: 'Work', 'Social', 'Technical', 'Travel', 'Health', 'Writing'). Please respond with a filter criteria in the following format: {"criteria": [{"property":"<property_name>", "value":"<filter_value>"}], "logicalOperator": "<AND or OR>"}. The logicalOperator should be used to specify if the criteria should be applied as an 'AND' or 'OR' condition.
    For example, if the user queries about their notes from july '23, the correct response would be {"criteria": [{"property":"noteDate","value":"July"},{"property":"noteDate","value":"2023"}], "logicalOperator": "AND"}. If it were June 2024, and the user asked about notes from the last month, the correct filter criteria would be {"criteria": [{"property":"noteDate","value":"May"},{"property":"noteDate","value":"2024"}], "logicalOperator": "AND"}.
    Given the available folders, you can also provide a filter criteria specifying one of these folders, if it is likely to contain relevant notes. For example, if the user asks about their work, the correct response would be {"criteria": [{"property":"folder","value":"Work"}], "logicalOperator": "AND"}, if asking about friends, perhaps {"criteria": [{"property":"folder","value":"Social"}], "logicalOperator": "AND"}.
    You can also combine these - if the user asks about their travels this year, the correct response would be {"criteria": [{"property":"folder","value":"Travel"},{"property":"noteDate","value":"2024"}], "logicalOperator": "AND"}.
    If the user asks about notes from the last two years, the correct response would be {"criteria": [{"property":"noteDate","value":"2023"},{"property":"noteDate","value":"2024"}], "logicalOperator": "OR"}.
    The current date is: ${getFormattedDate()}
    The next thing you see is the query from the user - your job is only to provide filtering criteria if relevant, not to answer the question itself. If no filtering criteria seems relevant, respond with {"criteria": [], "logicalOperator": "AND"}.
    Query: ${query}`,
  });

  return object;
}

console.log(
  await getFilteringCriteria("tell me about my notes from the last two years")
);
