import { HierarchicalNSW } from "hnswlib-node";
import * as tf from "@tensorflow/tfjs-node"; // Ensure the Node.js backend is registered
import * as use from "@tensorflow-models/universal-sentence-encoder";
import { embedText } from "../utils/text-processing";

tf.getBackend();
const model: use.UniversalSentenceEncoder = await use.load();

const index = new HierarchicalNSW("cosine", 512);
index.readIndexSync("index.dat");

const query = "what did I do in July?";
const embeddedQuery = await embedText(query, model);
const result = index.searchKnn(embeddedQuery, 10);
console.log(result);

console.table(result);
