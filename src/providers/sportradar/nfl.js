import { handler } from "./index.js";
export default async function fetchNFL(type, params = {}, opts = {}) {
  return handler("nfl", type, params, opts);
}
export { fetchNFL };
