// Secret scan over tracked files (git grep), run as `npm run secrets`.
//
// 1. Key-shaped patterns (Google API keys: classic "AIza…" and the newer "AQ.…";
//    OpenAI-style key; JWT) across every file.
// 2. The prompt's literal pattern `AIza|sk-|eyJhbGci`, excluding the two files with
//    known false positives: the prompt that quotes the pattern, and the lockfile
//    (`queue-microtask-1.2.3.tgz` contains "sk-"). See docs/DECISIONS.md.
import { spawnSync } from "node:child_process";

const checks = [
  {
    name: "key-shaped",
    args: ["grep", "--untracked", "-nE", "AIza[0-9A-Za-z_-]{30,}|AQ\\.[0-9A-Za-z_-]{40,}|sk-[A-Za-z0-9_-]{20,}|eyJhbGci[A-Za-z0-9_-]{10,}|service_role\\s*[:=]"],
  },
  {
    name: "literal",
    args: [
      "grep", "--untracked", "-nE", "AIza|sk-|eyJhbGci", "--", ".",
      ":!docs/IMPLEMENTATION_PROMPT.md", ":!package-lock.json", ":!scripts/secret-grep.mjs",
    ],
  },
];

let failed = false;
for (const { name, args } of checks) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  // git grep exits 1 when nothing matches.
  if (res.status === 0) {
    failed = true;
    console.error(`SECRET-GREP (${name}): HITS FOUND\n${res.stdout}`);
  } else if (res.status !== 1) {
    failed = true;
    console.error(`SECRET-GREP (${name}): git grep failed\n${res.stderr}`);
  } else {
    console.log(`SECRET-GREP (${name}): zero hits`);
  }
}
process.exit(failed ? 1 : 0);
