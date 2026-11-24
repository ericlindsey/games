# games

A space to experiment with game design and programming. Each game lives in its own
top-level folder and is fully self-contained.

## Repo layout

```
/                        repo root: README, LICENSE, this file
/index.html              landing page for GitHub Pages, linking each game
/rangers-of-ithilien/    open-world Three.js game (see its CLAUDE.md and PLAN.md)
/station/                ring-station simulator in Three.js (see its CLAUDE.md and PLAN.md)
```

## Conventions for every game

- **One folder per game.** Nothing in one game's folder may import from another's.
  If code is ever worth sharing, we will create a `/shared` folder deliberately.
- **Static and build-free by default.** A game must run by serving its folder with
  any static file server and opening `index.html`. No bundler, no transpiler, no
  `npm install` needed to play. Third-party libraries are vendored into the game's
  `vendor/` folder at a pinned version (no CDN at runtime, so games work offline).
- **Each game folder has its own `CLAUDE.md`** (architecture, conventions, how to
  verify) and, while in active development, a `PLAN.md` (roadmap and open questions).
  Read both before changing a game. Keep them current: when a decision in PLAN.md is
  made or changed, update the file in the same commit as the code.
- **No copyrighted assets.** Geometry, textures, and sound are generated in code or
  made by us. Do not copy text, art, music, or maps from books, films, or other games.

## Running a game locally

```
cd <game-folder>
python3 -m http.server 8000     # then open http://localhost:8000
```

ES modules do not load from `file://`, so always use a server.

## Verifying changes

Never report a change as working on the strength of reading the code. Run the game
in a real browser (headless Chromium via Playwright is fine), check the console for
errors, and look at a screenshot. Each game's CLAUDE.md lists its own checks.

## Git

- Small, focused commits with a message that says what changed and why.
- When a substantial change is ready to test (it runs, the checks in the game's
  CLAUDE.md have been done, and its docs are current), push it and open a pull
  request without waiting to be asked. Put what changed, how it was checked, and
  how to try it in the description. If a pull request for the branch is already
  open, push to it and update its description instead of opening another.
- Do not watch CI or pull request comments: this repo does not use them. The
  owner tests the pull request and reports problems in the conversation.
