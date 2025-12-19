import { ensureFetch, getFetch } from "./fetch-polyfill.js";

// Ensure fetch is available at module load time.
await ensureFetch();

export default globalThis.fetch;
export { ensureFetch, getFetch };
