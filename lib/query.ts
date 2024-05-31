import { HierarchicalNSW } from "hnswlib-node";
import { getUseModel, embedText } from "../utils/tensorflow";

const index = new HierarchicalNSW("cosine", 512);
index.readIndexSync("index.dat");

const query = "what are my thoughts on dc";
const embeddedQuery = await embedText(query, await getUseModel());
const result = index.searchKnn(embeddedQuery, 10);
console.log(result);

const file = Bun.file("embeddings.json");

const notes = await file.json();

for (let idx of result.neighbors) {
  console.log(notes[idx].chunk);
}
