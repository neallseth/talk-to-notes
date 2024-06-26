export type EmbeddingEntry = {
  id: number;
  chunk: string;
  embedding: number[];
  folder: string;
  noteName: string;
  noteDate: string;
};

export type RawEvent = {
  name: string;
  date: string;
  description: string;
  location: string;
};

export type FormattedEvent = {
  name: string;
  date: string;
  link: string;
};
