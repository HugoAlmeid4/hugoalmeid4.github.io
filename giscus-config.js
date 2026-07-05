// ─── Giscus configuration ──────────────────────────────────────────────────
// Comments live in GitHub Discussions, not a separate database. All keys
// are populated (REPO + REPO_ID + CATEGORY + CATEGORY_ID from giscus.app).
// CATEGORY is "Announcements" — GitHub lets you set this category's
// permissions (Anyone / Maintainers) at Settings → Discussions →
// Categories. The giscus bot has install-level permissions so it can
// create threads even if Announcements is set to "Maintainers only",
// meaning giscus comments work either way:
//
//   - Permissions: Anyone   → visitors can create threads directly on
//                              github.com in addition to commenting via
//                              giscus. (Best choice when you want fully
//                              open discussion.)
//   - Permissions: Maintainers (default for Announcements) → only the
//                              giscus bot + repo maintainers can create
//                              threads directly; visitors still comment via
//                              giscus because the bot creates the thread
//                              on first comment. Tighter spam control.
//
// The comment form is hosted in an iframe by giscus.app — you don't own
// it, so a traditional captcha isn't possible. Manual moderation lives
// at github.com/<owner>/<repo>/discussions.
// ───────────────────────────────────────────────────────────────────────────
window.GISCUS_REPO        = 'HugoAlmeid4/hugoalmeid4.github.io';
window.GISCUS_REPO_ID     = 'R_kgDORs7vVw';
window.GISCUS_CATEGORY    = 'Announcements';              // from giscus.app
window.GISCUS_CATEGORY_ID = 'DIC_kwDORs7vV84DAjcC';       // from giscus.app
window.GISCUS_LANG        = 'en';
window.GISCUS_THEME       = 'preferred_color_scheme';

// Mapping strategy. Posts open as overlays on "/" (URL = /?post=slug), so
// every overlay shares the same pathname. If we used 'pathname' here they'd
// ALL collapse into one Discussion thread. 'specific' pairs with the post
// slug via data-term in posts.js → one thread per post. Switch to
// 'pathname' later if/when posts get their own URLs.
window.GISCUS_MAPPING     = 'specific';
window.GISCUS_STRICT      = '0';

window.GISCUS_REACTIONS_ENABLED = '1';
window.GISCUS_EMIT_METADATA     = '0';
window.GISCUS_INPUT_POSITION    = 'bottom';
