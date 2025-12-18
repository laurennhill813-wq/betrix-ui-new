import { handler } from "./index.js";
export default async function fetchMLB(type, params = {}, opts = {}) {
  return handler("mlb", type, params, opts);
}
export { fetchMLB };
