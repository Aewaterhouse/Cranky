"""Discord bot that turns well-voted ideas into GitHub issues. Run: python bot/ideas_bot.py"""

import logging
import sys
from pathlib import Path

import aiohttp
import discord

sys.path.insert(0, str(Path(__file__).parent))
import config as cfg  # noqa: E402
from votes import Person, idea_counts, issue_body, issue_title, qualifying_voters  # noqa: E402

log = logging.getLogger("ideas_bot")
API = f"https://api.github.com/repos/{cfg.GITHUB_REPO}"
HEADERS = {
    "Authorization": f"Bearer {cfg.GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


class IdeasBot(discord.Client):
    """Watches the ideas channel and files GitHub issues."""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.reactions = True
        super().__init__(intents=intents)
        self.http_session: aiohttp.ClientSession
        self.busy: set[int] = set()

    async def setup_hook(self) -> None:
        self.http_session = aiohttp.ClientSession(headers=HEADERS)
        for label in cfg.LABELS:
            async with self.http_session.post(f"{API}/labels", json={"name": label}) as r:
                if r.status not in (201, 422):
                    log.error("Creating label %s failed: %s %s", label, r.status, await r.text())

    async def close(self) -> None:
        if hasattr(self, "http_session"):
            await self.http_session.close()
        await super().close()

    async def person(self, guild: discord.Guild, user: discord.abc.User) -> Person | None:
        member = guild.get_member(user.id)
        if member is None:
            try:
                member = await guild.fetch_member(user.id)
            except discord.NotFound:
                return None
        roles = frozenset(r.name for r in member.roles)
        return Person(member.id, member.display_name, roles, member.bot)

    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent) -> None:
        if str(payload.emoji) != cfg.VOTE_EMOJI or payload.guild_id is None:
            return
        if payload.message_id in self.busy:
            return
        channel = self.get_channel(payload.channel_id) or await self.fetch_channel(payload.channel_id)
        if isinstance(channel, discord.Thread):
            if channel.parent_id != cfg.IDEAS_CHANNEL_ID or payload.message_id != channel.id:
                return
        elif channel.id != cfg.IDEAS_CHANNEL_ID:
            return
        self.busy.add(payload.message_id)
        try:
            await self.consider(channel, payload.message_id)
        except Exception:
            log.exception("Handling message %s failed", payload.message_id)
        finally:
            self.busy.discard(payload.message_id)

    async def consider(self, channel: discord.abc.Messageable, message_id: int) -> None:
        message = await channel.fetch_message(message_id)
        if any(str(r.emoji) == cfg.DONE_EMOJI and r.me for r in message.reactions):
            return
        guild = message.guild
        author = await self.person(guild, message.author)
        if author is None:
            return
        voters = []
        for reaction in message.reactions:
            if str(reaction.emoji) == cfg.VOTE_EMOJI:
                async for user in reaction.users():
                    if (p := await self.person(guild, user)) is not None:
                        voters.append(p)
        if not idea_counts(author, voters, cfg.TEAM_ROLE, cfg.VOTES_NEEDED):
            return
        title = issue_title(
            channel.name if isinstance(channel, discord.Thread) else None, message.content, cfg.TITLE_MAX
        )
        voter_list = qualifying_voters(author, voters, cfg.TEAM_ROLE)
        body = issue_body(message.content, message.jump_url, author, voter_list)
        payload = {"title": title, "body": body, "labels": list(cfg.LABELS)}
        async with self.http_session.post(f"{API}/issues", json=payload) as r:
            if r.status != 201:
                log.error("Creating issue failed: %s %s", r.status, await r.text())
                return
            url = (await r.json())["html_url"]
        await message.add_reaction(cfg.DONE_EMOJI)
        await message.reply(f"Filed as a GitHub issue: {url}")


def main() -> None:
    missing = [k for k in ("DISCORD_TOKEN", "GITHUB_TOKEN", "IDEAS_CHANNEL_ID") if not getattr(cfg, k)]
    if missing:
        sys.exit(f"Missing settings: {', '.join(missing)}. Set them in bot/.env (see bot/.env.example).")
    IdeasBot().run(cfg.DISCORD_TOKEN)


if __name__ == "__main__":
    main()
