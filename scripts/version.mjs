// Coded by OpenAI Codex. Derive release numbers from history, not build time.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

export function releaseVersion(root, {
    commitSha = process.env.VERCEL_GIT_COMMIT_SHA,
    repositoryUrl = "https://github.com/Pengeszikra/terminal-is-your-friend.git",
} = {}) {
    const git = (cwd, ...args) => execFileSync("git", args, {
        cwd, encoding: "utf8", timeout: 60_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const fromHistory = (directory, head) => {
        const dates = git(directory, "log", "--first-parent", "--merges", "--format=%cI", head).split("\n").filter(Boolean);
        return versionFromMergeDates(dates, git(directory, "show", "-s", "--format=%cI", head));
    };
    let head = commitSha;
    if (existsSync(join(root, ".git"))) {
        head ||= git(root, "rev-parse", "HEAD");
        if (git(root, "rev-parse", "--is-shallow-repository") === "false") {
            return fromHistory(root, head);
        }
    }
    if (!/^[a-f0-9]{40}$/i.test(head ?? "")) {
        throw new Error("Release version needs a Git checkout or VERCEL_GIT_COMMIT_SHA identifying the deployed commit.");
    }
    // Vercel may omit .git entirely. Fetch the immutable deployment commit's
    // history into a temporary bare repo; never use a moving branch or build date.
    const directory = mkdtempSync(join(tmpdir(), "tiyf-release-"));
    try {
        git(directory, "init", "--bare");
        git(directory, "fetch", "--no-tags", repositoryUrl, head);
        return fromHistory(directory, head);
    } catch (cause) {
        throw new Error("Cannot fetch release history for the deployed commit from the public repository.", { cause });
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}
