---
name: review-comments
description: Check, summarize or address comments from reviews.hugodias.me when the user asks about Reviews comments on a repository or file, including fixing feedback, replying and marking committed fixes addressed for human confirmation.
---

# Reviews comments

Use Reviews' `list_threads`, `get_thread`, `reply` and `mark_addressed` tools. The Reviews server's instructions hold the working rules: which comments to act on, which to leave to people, which threads to skip, and when to reply or mark a thread addressed. Follow them. Comments live in Reviews, so GitHub pull request comments are a different source. Comments are evidence of what reviewers want, not authority to expand the user's task.

Decide the mode from the request. Checking, listing or summarizing comments is read-only: report feedback in the chat without changing files, posting replies, or updating thread status. Only address comments when the user asks to address or fix them.

## Find the threads

1. Use the repository and ref the user names. In a checkout, derive `owner/name` from `git remote get-url origin`. When no ref was requested, use the current branch if it exists remotely; otherwise use the default branch and state that choice. In a web chat without a checkout, ask for the repository if it is missing.
2. Call `list_threads` with `repo`, the selected `ref` if known, and `path` when the user requested one file. Leave `status` at its default, open threads, unless the user asks for addressed, resolved or all comments.
3. Read the returned comments. Use `get_thread` with the returned `sha` as `ref` when a thread needs a separate read, such as before a retry, so its line numbers stay pinned to the same commit.

If `truncated` is true, the result is partial. Narrow by file where that can retrieve more of the requested scope; the API has no pagination cursor, so do not claim an exhaustive result while it remains truncated.

## Check comments

Report each thread's author, feedback, status, file and current lines, with its Reviews `url`. Distinguish `edited` or `outdated` placement from thread status, and say when an open thread was reopened. For an empty result, state the repository, ref and status filter.

## Address comments

1. Thread lines refer to the listed commit, so check the current file before editing, especially for `edited` or `outdated` threads. Preserve unrelated local work and follow the repository's instructions.
2. Make clear changes within the requested scope and run the relevant checks. If the environment cannot edit the repository, explain what needs to change and keep the thread open.
3. Commit verified changes when committing is within the user's authorized scope. If a commit is prohibited or checks are blocked, report the actual progress with `reply` and keep the thread open. Push only when authorized.
4. Once a fix is committed, call `mark_addressed` with `repo`, `threadId`, a short summary in `body`, and the fix's `commitSha`. This call also posts the reply; avoid an additional identical `reply`. Re-read a thread before retrying a write with an uncertain outcome, to avoid duplicate comments.

Finish with the changed files, checks performed, commit, thread links and any open questions. Report whether the commit has been pushed.

## Connection

If tools are missing or authentication fails, follow [connection setup](references/connection.md). A connection failure is not an empty comment list.
