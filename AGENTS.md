# AGENTS.md

## Project

`abhishekdoesstuff.com` is Abhishek Bagade's hacker/maker homepage. It is a static HTML/CSS/JS site intended for Coolify hosting, with an optional public-safe telemetry API from a Lenovo M900 Tiny.

## Run

```bash
npm install
npm start
```

## Files

- `index.html` — homepage markup
- `styles.css` — visual system; dark terminal/maker-lab style
- `server.js` — static file server and `/api/status` proxy
- `agent/m900-status-agent.py` — tiny Python status API
- `agent/m900-status-agent.service` — systemd unit for the API

## Constraints

- Keep homepage static and fast.
- Public status API must not expose LAN IPs, usernames, mounts, process names, kernel args, container IDs, service lists, or internal ports.
- Prefer direct GitHub pushes/PRs over local-only changes.
- User prefers direct CAD/project download links and practical maker tone.

## Deploy notes

Coolify app runs the Node server. Set `STATUS_UPSTREAM=http://192.168.1.61:9109/status` if the default changes.
