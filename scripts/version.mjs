// Coded by OpenAI Codex. Derive release numbers from history, not build time.
import { execFileSync } from "node:child_process";

const monthOf = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid release commit date.");
    return date.toISOString().slice(2, 7);
};

export function versionFromMergeDates(dates, fallbackDate) {
    const month = monthOf(dates[0] ?? fallbackDate);
    const count = dates.filter(date => monthOf(date) === month).length;
    return `${month}-${String(count).padStart(2, "0")}`;
}

export function releaseVersion(root) {
    const git = (...args) => execFileSync("git", args, {
        cwd: root, encoding: "utf8", timeout: 60_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    try {
        // Pin the checkout: fetching history must never change the build's commit.
        const head = git("rev-parse", "HEAD");
        if (git("rev-parse", "--is-shallow-repository") === "true") {
            git("fetch", "--unshallow", "--no-tags", "origin");
            if (git("rev-parse", "--is-shallow-repository") === "true") throw new Error("Incomplete history");
        }
        const dates = git("log", "--first-parent", "--merges", "--format=%cI", head).split("\n").filter(Boolean);
        return versionFromMergeDates(dates, git("show", "-s", "--format=%cI", head));
    } catch {
        throw new Error("Cannot determine release version. Build from a Git checkout with complete history; shallow clones need access to origin for git fetch --unshallow.");
    }
}
