import { handler } from "./index.js";
export default async function fetchTennis(type, params = {}, opts = {}) {
  return handler("tennis", type, params, opts);
}
export { fetchTennis };
