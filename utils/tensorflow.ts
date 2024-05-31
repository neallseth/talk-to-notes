import * as tf from "@tensorflow/tfjs-node"; // Ensure the Node.js backend is registered
import * as use from "@tensorflow-models/universal-sentence-encoder";

export const getUseModel = async () => {
  tf.getBackend();
  return await use.load();
};

export const embedText = async (
  text: string,
  model: use.UniversalSentenceEncoder
) => {
  const embeddings = await model.embed([text]);
  return embeddings.arraySync()[0];
};
