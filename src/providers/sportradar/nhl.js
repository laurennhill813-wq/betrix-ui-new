import { handler } from "./index.js";
export default async function fetchNHL(type, params = {}, opts = {}) {
  return handler("nhl", type, params, opts);
}
export { fetchNHL };
