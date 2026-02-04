# Daves Pipes Leaderboard Worker

## Setup

1. Install Wrangler and log in.

```bash
npm install -g wrangler
wrangler login
```

2. Create KV namespaces.

```bash
wrangler kv:namespace create LEADERBOARD_KV
wrangler kv:namespace create LEADERBOARD_KV --preview
```

3. Update `worker/wrangler.toml` with the KV namespace IDs.

4. Deploy the worker.

```bash
wrangler deploy
```

## API

- `GET /` returns `{ "top10": [{ "score": number, "name": string, "ts": number }] }`
- `POST /` with `{ "score": number, "name": string }` returns the updated top10 list
