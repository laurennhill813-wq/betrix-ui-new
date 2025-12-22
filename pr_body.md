start-server.js: added non-secret startup prints (CWD, root files, RAPIDAPI_KEY presence/length).
worker-final.js: added concise debug line indicating prefetch scheduler and RapidAPI proxy logging active.

Logs intentionally mask secrets (only presence and length shown).

This PR adds safe, non-secret startup debug prints to help triage deploy issues and confirm that prefetch and RapidAPI logging are active.
