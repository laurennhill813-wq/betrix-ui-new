import { handler } from "./index.js";
export default async function fetchNBA(type, params = {}, opts = {}) {
  return handler("nba", type, params, opts);
}
export { fetchNBA };
