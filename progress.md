Original prompt: I want to build a flappy bird clone using an image which I can provide later. This is avoiding pipes and has a global highscore which will be using a cloudflare worker. Its called Flappy Dave and has a plumbing theme

- Rebuilt from scratch as a pure web app: `index.html`, `style.css`, `game.js`.
- Implemented Flappy Dave gameplay, plumbing theme (brick barricades, valves), and no pipes.
- Added local best + global highscore fetch/submit hooks.
- Added `window.advanceTime` and `window.render_game_to_text`.
- Added optional `window.FLAPPY_DAVE_PLAYER_IMAGE_URL` for the player image.
- Set player object to `assets/hazard.png` and restored pipe obstacles.
- Added `assets/dave.png` logo on the title screen and updated title to “Daves Pipes”.
- Added HTML title + logo above the canvas; removed in-canvas title/brand.
- Added a sidebar leaderboard UI and wired global top 10 fetch/submit.

TODO:
- Plug in Cloudflare Worker URL and confirm response JSON shape.
- Replace placeholder Dave art with the provided image.
