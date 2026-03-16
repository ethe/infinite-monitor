export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchProvider = "exa" | "brave" | "parallel";

export const SEARCH_PROVIDERS: {
  id: SearchProvider;
  name: string;
  placeholder: string;
}[] = [
  { id: "exa", name: "Exa", placeholder: "Exa API key…" },
  { id: "brave", name: "Brave", placeholder: "Brave API key…" },
  { id: "parallel", name: "Parallel", placeholder: "Parallel API key…" },
];

async function searchExa(query: string, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, numResults: 10 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Exa search failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: { title?: string; url: string; text?: string }) => ({
    title: r.title ?? "",
    url: r.url,
    snippet: r.text ?? "",
  }));
}

async function searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: "10" });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`);
  const data = await res.json();
  return (data.web?.results ?? []).map((r: { title?: string; url: string; description?: string }) => ({
    title: r.title ?? "",
    url: r.url,
    snippet: r.description ?? "",
  }));
}

async function searchParallel(query: string, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.parallel.ai/v1beta/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      objective: query,
      search_queries: [query],
      mode: "fast",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Parallel search failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: { title?: string; url: string; excerpts?: string[] }) => ({
    title: r.title ?? "",
    url: r.url,
    snippet: (r.excerpts ?? []).join(" "),
  }));
}

const providers: Record<SearchProvider, (query: string, apiKey: string) => Promise<SearchResult[]>> = {
  exa: searchExa,
  brave: searchBrave,
  parallel: searchParallel,
};

export async function webSearch(
  provider: SearchProvider,
  query: string,
  apiKey: string,
): Promise<SearchResult[]> {
  const fn = providers[provider];
  if (!fn) throw new Error(`Unknown search provider: ${provider}`);
  return fn(query, apiKey);
}
