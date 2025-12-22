#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
// Small, safe startup debug prints (non-secret): CWD, top-level listing, env presence
try {
	console.log('[debug] bin/start-server.js CWD=', process.cwd());
	try { console.log('[debug] project root files=', fs.readdirSync(process.cwd()).slice(0,40)); } catch (e) { /* ignore */ }
	const rapidapiPresent = !!process.env.RAPIDAPI_KEY;
	const rapidapiLen = process.env.RAPIDAPI_KEY ? String(process.env.RAPIDAPI_KEY).length : 0;
	console.log(`[debug] RAPIDAPI_KEY present=${rapidapiPresent} length=${rapidapiLen}`);
} catch (e) {
	// Keep startup robust: don't fail on debug logging
	try { console.warn('[debug] startup logging failed', e && e.message ? e.message : e); } catch (e2) {}
}

import { startServer } from "../src/server.js";

startServer();
