// Coded by OpenAI Codex. Real Git fixtures exercise merging and shallow CI checkouts.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { releaseVersion, versionFromMergeDates } from "../scripts/version.mjs";

test("release month uses UTC merge dates and resets its sequence each month", () => {
    assert.equal(versionFromMergeDates(["2026-10-04T10:00:00+02:00", "2026-10-01T12:00:00Z", "2026-09-30T20:00:00Z"]), "26-10-02");
    assert.equal(versionFromMergeDates(["2026-11-01T12:00:00Z", "2026-10-31T12:00:00Z"]), "26-11-01");
    assert.equal(versionFromMergeDates(["2026-11-01T00:30:00+02:00", "2026-10-30T12:00:00Z"]), "26-10-02");
    assert.equal(versionFromMergeDates([], "2026-10-04T12:00:00Z"), "26-10-00");
});

test("every mainline merge increments once; rebuilds and shallow clones keep the same version", () => {
    const directory = mkdtempSync(join(tmpdir(), "tiyf-version-"));
    const repo = join(directory, "repo"), shallow = join(directory, "shallow");
    const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: {
        ...process.env, GIT_AUTHOR_NAME: "Version test", GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "Version test", GIT_COMMITTER_EMAIL: "test@example.invalid",
        GIT_AUTHOR_DATE: "2026-10-04T10:00:00Z", GIT_COMMITTER_DATE: "2026-10-04T10:00:00Z",
    } }).trim();
    try {
        git(directory, "init", "-b", "main", repo);
        git(repo, "commit", "--allow-empty", "-m", "Initial");
        assert.equal(releaseVersion(repo), "26-10-00");
        for (let i = 1; i <= 2; i++) {
            git(repo, "switch", "-c", `feature-${i}`);
            git(repo, "commit", "--allow-empty", "-m", "Feature");
            git(repo, "switch", "main");
            git(repo, "merge", "--no-ff", `feature-${i}`, "-m", `Merge ${i}`);
            assert.equal(releaseVersion(repo), `26-10-0${i}`);
        }
        assert.equal(releaseVersion(repo), "26-10-02", "Rebuilding does not increment");
        git(directory, "clone", "--depth=1", pathToFileURL(repo).href, shallow);
        const head = git(shallow, "rev-parse", "HEAD");
        assert.equal(releaseVersion(shallow), "26-10-02");
        assert.equal(git(shallow, "rev-parse", "HEAD"), head, "Fetching history does not move HEAD");
        assert.equal(git(shallow, "rev-parse", "--is-shallow-repository"), "false");
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("built application displays its release number without a template placeholder", () => {
    const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
    assert.match(html, /id="app-version"[^>]*>\d{2}-\d{2}-\d{2,}</);
    assert.doesNotMatch(html, /__TIYF_VERSION__/);
});
