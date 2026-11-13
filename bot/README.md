# Ideas bot

Crew post ideas in one Discord channel (text or forum). When an idea gets 2 👍 votes from crew members other than
its author, the bot opens a GitHub issue labelled `idea` and `agent-ready`, adds a ✅ to the message and replies
with the issue link. Only members with the team role (default `Crew`) can post ideas or vote.

## Set-up

1. Go to the [Discord developer portal](https://discord.com/developers/applications), create an application and
   add a bot under **Bot**. Copy the token into `DISCORD_TOKEN`.
2. Under **Bot**, switch on the **Message Content Intent**. The Server Members intent is not needed.
3. Invite it with the `bot` scope (OAuth2, URL Generator) and these permissions: View Channel, Read Message
   History, Add Reactions, Send Messages, Send Messages in Threads. Make sure it can see the ideas channel.
4. Make a role called `Crew` (or set `TEAM_ROLE`) and give it to the crew.
5. Turn on Developer Mode (User Settings, Advanced), right-click the ideas channel and choose Copy Channel ID.
   Put it in `IDEAS_CHANNEL_ID`.
6. On GitHub, create a fine-grained personal access token limited to the `Aewaterhouse/Cranky` repository only,
   with **Issues: read and write** and nothing else. Put it in `GITHUB_TOKEN`.
7. Copy `bot/.env.example` to `bot/.env` and fill it in. Never commit `.env`.

## Run

From the repo root:

```
pip install -r bot/requirements.txt
python bot/ideas_bot.py
```

The bot creates the two labels on first start if they are missing. It remembers nothing between runs: it
recounts votes from the message each time and skips any message it has already marked with ✅.

## Building the ideas

Nothing builds an idea until a crew member turns polling on. From the repo root, in Git Bash or a terminal:

```
GITHUB_TOKEN=... bash scripts/agent-poll.sh --dry-run   # lists what it would take
GITHUB_TOKEN=... bash scripts/agent-poll.sh             # polls for 2 hours, up to 3 issues
```

This needs Claude Code signed in on that PC, git push access to the repo, and a fine-grained GitHub token for
this repository with **Issues** and **Pull requests** read and write. For each `agent-ready` issue it relabels
the issue `agent-working`, runs Claude Code in a fresh worktree beside the repo (`../cranky-agent`), pushes the
branch `agent/issue-N` and opens a pull request, then labels the issue `agent-done` or `agent-failed`. It never
pushes to `master` and never merges: a person reviews every pull request. To stop an idea being built, remove
its `agent-ready` label or close the issue. `bash scripts/agent-poll.sh --help` lists the settings.

The agent runs as you, on your PC, with a limited list of allowed commands. That is not a sandbox: the tests it
runs are code it may have written. Only crew can post ideas for that reason.

## Tests

```
python -m pytest bot/tests -q
```

The tests need no Discord or GitHub access.
