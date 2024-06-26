export function getFormattedDate(): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options); // Wednesday, June 5, 2024
}

export function extractUrl(rawContent: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/;

  // Find the first match of the regex in the string
  const match = rawContent.match(urlRegex);

  // Return the matched URL or null if no match is found
  return match ? match[0] : null;
}
