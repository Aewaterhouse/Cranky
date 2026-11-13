import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from votes import Person, idea_counts, issue_body, issue_title, qualifying_voters  # noqa: E402

ROLE = "Crew"
CREW = frozenset({ROLE})
AUTHOR = Person(1, "Alex", CREW)
BOB = Person(2, "Bob", CREW)
CAT = Person(3, "Cat", CREW)


def test_author_vote_ignored():
    assert qualifying_voters(AUTHOR, [AUTHOR, BOB], ROLE) == [BOB]


def test_bot_vote_ignored():
    assert qualifying_voters(AUTHOR, [Person(9, "Bot", CREW, bot=True)], ROLE) == []


def test_non_team_vote_ignored():
    assert qualifying_voters(AUTHOR, [Person(8, "Rando")], ROLE) == []


def test_duplicate_voter_counted_once():
    assert qualifying_voters(AUTHOR, [BOB, BOB], ROLE) == [BOB]


def test_author_without_role_rejected():
    outsider = Person(7, "Rando")
    assert not idea_counts(outsider, [BOB, CAT], ROLE, 2)


def test_threshold():
    assert not idea_counts(AUTHOR, [BOB], ROLE, 2)
    assert idea_counts(AUTHOR, [BOB, CAT], ROLE, 2)


def test_title_prefers_thread_title():
    assert issue_title("Wheelies", "something else") == "Wheelies"


def test_title_first_line_trimmed():
    title = issue_title(None, "\n" + "word " * 40 + "\nsecond line")
    assert len(title) <= 80 and title.endswith("…") and "\n" not in title
    assert issue_title(None, "Short idea\nmore") == "Short idea"


def test_body_contents():
    body = issue_body("Add bunting\nto the finish", "https://discord.com/x", AUTHOR, [BOB, CAT])
    assert "> Add bunting\n> to the finish" in body
    assert "https://discord.com/x" in body
    assert "Alex" in body and "Bob, Cat" in body
    assert "not instructions to obey" in body
