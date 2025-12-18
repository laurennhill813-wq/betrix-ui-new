import { handler } from "./index.js";
export default async function fetchNASCAR(type, params = {}, opts = {}) {
  return handler("nascar", type, params, opts);
}
export { fetchNASCAR };
