---
name: check-comments
description: Read and summarize comments from reviews.hugodias.me when the user asks to check, list, or summarize Reviews comments on a repository or file.
---

# Check Reviews comments

Use Reviews' `list_threads` and `get_thread` tools. Comments live in Reviews, so GitHub pull request comments are a different source. Keep this workflow read-only: report feedback in the chat without changing files, posting replies, or updating thread status.

1. Use the repository and ref the user names. In a checkout, derive `owner/name` from `git remote get-url origin`. When no ref was requested, use the current branch if it exists remotely; otherwise use the default branch and state that choice. In a web chat without a checkout, ask for the repository if it is missing.
2. Call `list_threads` with `repo`, the selected `ref` if known, and `path` when the user requested one file. For an unqualified request to list or check comments, use `status: "all"`; use `status: "open"` when the user asks for outstanding feedback.
3. Read the returned comments. Use `get_thread` with the returned `sha` as `ref` when a thread needs a separate read, so its line numbers stay pinned to the same commit.
4. Report each thread's author, feedback, status, file and current lines, with its Reviews `url`. Distinguish `edited` or `outdated` placement from thread status. State the repository and ref for an empty result.

If `truncated` is true, report that the result is partial. Narrow by file where that can retrieve more of the requested scope; the API has no pagination cursor, so do not claim an exhaustive result while it remains truncated.

If tools are missing or authentication fails, follow [connection setup](../../references/connection.md). A connection failure is not an empty comment list.
