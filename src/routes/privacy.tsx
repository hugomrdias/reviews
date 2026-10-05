import { createFileRoute, Link } from '@tanstack/react-router'
import { Brand, Credit } from '@/components/home/SiteChrome'

// What Reviews stores, where, and for how long. Keep it true to the code: when
// storage, cookies, caching or logging changes, change this page in the same PR.
export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy · Reviews' }] }),
  component: Privacy,
})

const REPO = 'https://github.com/hugomrdias/reviews'

function Privacy() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-10 md:py-16">
      <Link to="/" className="self-start">
        <Brand />
      </Link>

      <main className="flex-1 py-14">
        <article className="doc">
          <h1>Privacy</h1>
          <p>
            Reviews is made and run by <a href="https://hugodias.me">Hugo Dias</a>. Its{' '}
            <a href={REPO}>source is public</a>, so you can check everything below against the code. Last updated 5
            October 2026.
          </p>

          <h2>What Reviews reads on GitHub</h2>
          <p>
            You sign in with GitHub. The Reviews GitHub App asks for read-only access to repository contents and
            metadata, and only for the repositories you install it on. Reviews reads files with your own GitHub token,
            so it only ever sees what your account can read. It never writes to GitHub.
          </p>

          <h2>What Reviews stores</h2>
          <ul>
            <li>
              <strong>Your GitHub profile:</strong> your user id, username, display name and avatar URL, refreshed each
              time you sign in. Not your email address.
            </li>
            <li>
              <strong>Your comments:</strong> the comment text, the passage you selected (copied from the file, with a
              little text on either side so it can be found again), and the repository, file and commit it belongs to.
              Also who wrote it, when, and whether the thread is resolved. When a coding agent posts for you, the name
              the agent gave itself is stored with the comment.
            </li>
            <li>
              <strong>Your session:</strong> a random token in a cookie that lasts 30 days. The server keeps the
              session's GitHub tokens encrypted and deletes them when you sign out. If you never sign out, they're
              deleted within about six months, once GitHub's own expiry for them passes.
            </li>
            <li>
              <strong>Connected agents:</strong> each agent you connect gets its own encrypted GitHub token. Its
              access lasts an hour at a time and ends after 30 days without use, or as soon as you disconnect it.
            </li>
          </ul>
          <p>Reviews doesn't store your IP address or email address.</p>

          <h2>Cached copies of your repositories</h2>
          <p>
            To keep pages fast, Reviews caches what it reads from GitHub at Cloudflare: file contents, file lists and
            commit history for up to 30 days, and images shown in documents for up to a year. Cached copies are
            stored by content, and Reviews checks that you can read the repository before serving any of them.
            Checks of who can read what are cached for a few minutes, so access removed on GitHub can take up to about
            6 minutes to take effect here.
          </p>

          <h2>Who can see your comments</h2>
          <p>
            Only people who have been given access to the repository on GitHub, and only once the Reviews GitHub
            App is installed on it. That holds for public repositories too: being able to read a public repository
            isn't enough, so comments are never published to the web. What someone can do with
            comments follows their role on the repository, as described in the{' '}
            <a href={`${REPO}#readme`}>README</a>. Agents you connect can read comments in the same repositories you
            can, and post as you if you allowed that when connecting them.
          </p>

          <h2>Logs and error reports</h2>
          <p>
            Reviews runs on Cloudflare Workers with Cloudflare's logs, traces and error reports turned on. Errors are
            labeled with your GitHub user id and username, a one-way hash of your session token, and, for agents, the
            agent's name. Query strings are removed from logged URLs. Cloudflare may record more about each request,
            such as your IP address; see{' '}
            <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.
          </p>

          <h2>Analytics</h2>
          <p>
            Reviews counts visits with <a href="https://umami.is">Umami</a>, run by Hugo Dias.
            For each page you open, your browser sends the page's address and title, the page you came from,
            your screen size and language, and how quickly the page loaded. On file pages, the address and title are
            replaced before they leave your browser: Umami sees <code>/:owner/:repo</code> and &ldquo;File&rdquo;,
            never the repository or file. Query strings and <code>#</code> anchors are left off every address.
          </p>
          <p>
            From the request, Umami works out your browser, operating system, device type and rough location
            (country, region and city). It counts returning visitors with an id made from your IP address and browser
            that changes every month, and it doesn't store your IP address or set cookies. To opt out, run{' '}
            <code>localStorage.setItem('umami.disabled', '1')</code> in your browser's console on this site.
          </p>
          <p>
            Reviews has no ads, and no scripts from anyone else. Its fonts are served from Reviews itself. Your browser
            loads avatars from GitHub, and images in documents from wherever they're hosted, without sending the page
            address.
          </p>

          <h2>Cookies and browser storage</h2>
          <ul>
            <li>
              <code>__Host-session</code>: keeps you signed in, for 30 days.
            </li>
            <li>
              <code>oauth</code> and <code>return_to</code>: carry a sign-in across the trip to GitHub, for 10 minutes
              and 1 hour.
            </li>
            <li>
              Cookies starting with <code>__Host-oauth-</code>: carry an agent connection through its consent screen,
              for 10 minutes.
            </li>
            <li>
              <code>theme</code> and <code>sidebar_state</code>: remember your light or dark choice for a year, and
              whether the file sidebar is open for a week.
            </li>
            <li>
              Your browser's local storage keeps the last few files you opened, for the home page. It never leaves
              your browser.
            </li>
            <li>
              <code>umami.disabled</code> in local storage, if you set it, turns analytics off.
            </li>
          </ul>

          <h2>Who else handles your data</h2>
          <p>
            Cloudflare hosts Reviews: its database, caches and logs. Railway hosts the Umami analytics. GitHub
            handles sign-in and serves your repositories. Agents you connect receive the comments they ask for. Nobody
            else gets your data, and it's never sold.
          </p>

          <h2>Removing your data</h2>
          <ul>
            <li>Signing out deletes your session and its GitHub tokens.</li>
            <li>
              <strong>Connected agents</strong> in your account menu disconnects an agent and deletes its tokens.
            </li>
            <li>
              Uninstalling the GitHub App, or revoking it in your GitHub settings, stops Reviews from reading your
              repositories.
            </li>
            <li>
              Deleting a comment hides it from everyone, but its text stays in the database. To remove your profile,
              comments and threads for good, <a href={`${REPO}/issues`}>open an issue</a>. You don't need to say
              more than your GitHub username.
            </li>
          </ul>

          <h2>Changes</h2>
          <p>
            This page changes when Reviews does. Every version is in the{' '}
            <a href={`${REPO}/commits/main/src/routes/privacy.tsx`}>repository's history</a>.
          </p>
        </article>
      </main>

      <Credit />
    </div>
  )
}
