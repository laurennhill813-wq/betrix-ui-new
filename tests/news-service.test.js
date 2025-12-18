import assert from "assert";
import { test } from "node:test";
import { fetchArticleHtmlByLink } from "../src/services/news-service.js";

test("fetchArticleHtmlByLink returns wrapped HTML for example.com", async (t) => {
  const url = "https://example.com/";
  const html = await fetchArticleHtmlByLink(url);
  assert.ok(
    typeof html === "string" && html.length > 0,
    "HTML string returned",
  );
  assert.ok(
    html.includes("BETRIX") || html.includes("Betrix"),
    "Wrapped HTML includes BETRIX header",
  );
  assert.ok(
    html.includes("Open original") || html.includes(url),
    "Contains link to original article",
  );
});
