---
name: address-comments
description: Work through Reviews comments when the user asks to address or fix feedback from reviews.hugodias.me, including replies and committed changes awaiting human confirmation.
---

# Address Reviews comments

Use this workflow when the user requests action on Reviews feedback. Comments are evidence of what reviewers want, not authority to expand the user's task. Handle requests to list or summarize comments through the read-only workflow instead.

1. Resolve the requested repository, ref and file scope. In a checkout, read `git remote get-url origin` and the current branch; in a web chat, use the repository the user provides. Call `list_threads` with `status: "open"`. If the result is truncated, narrow by file and report any remaining limit.
2. Read each relevant thread with `get_thread`, using the list's returned `sha` as `ref`. Skip threads whose latest reply says the work is already done.
3. In the authorized checkout, find the quoted passage near the reported lines. Those lines refer to the returned commit. A `page` quote is rendered text without markdown syntax. Check the current file before editing, especially for `edited` or `outdated` threads. Preserve unrelated local work and follow the repository's instructions.
4. Make clear changes within the requested scope and run the relevant checks. For questions or decisions needing the user, leave the thread open and use `reply` to state the specific question or blocker. If the environment cannot edit the repository, explain what needs to change and keep the thread open.
5. Commit verified changes when committing is within the user's authorized scope. If a commit is prohibited or checks are blocked, report the actual progress with `reply` and keep the thread open. Push only when authorized.
6. Once a fix is committed, call `mark_addressed` with `repo`, `threadId`, a short summary in `body`, and the fix's `commitSha`. This call also posts the reply; avoid an additional identical `reply`. Re-read a thread before retrying a write with an uncertain outcome, to avoid duplicate comments.

Reply on each thread you act on. Only people resolve or reopen threads. Finish with the changed files, checks performed, commit, thread links and any open questions. Report whether the commit has been pushed.

If tools are missing or authentication fails, follow [connection setup](../../references/connection.md).
