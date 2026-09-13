# Shipping from Claude Code

Say, in the repo folder:

> build, run the flow test, and if it passes commit and push

Claude Code runs `python3 build.py && node tools/flow.js`, then `git add -A && git commit -m "…" && git push`.
GitHub Pages redeploys in about a minute. On the phone, pull to refresh (or kill the home-screen app and reopen).

## First time
1. Create an empty public repo on GitHub (e.g. `fantasyball`).
2. In this folder: `git init && git add -A && git commit -m "init" && git branch -M main && git remote add origin git@github.com:<you>/fantasyball.git && git push -u origin main`
3. Repo → Settings → Pages → Source: Deploy from a branch → Branch: main, folder: / (root) → Save.
4. Open `https://<you>.github.io/fantasyball/` on the phone → Share → Add to Home Screen.
