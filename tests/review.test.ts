import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReview } from "../src/agent.js";
import { ChapterReviewSchema } from "../src/domain.js";

function reviewWithSeverity(severity: "minor" | "major" | "blocking") {
  return ChapterReviewSchema.parse({
    score: 90,
    approved: true,
    strengths: ["章节主线完整。"],
    issues: [
      {
        severity,
        problem: "存在待修问题。",
        suggestion: "修复这个问题。",
      },
    ],
    revisionBrief: "",
  });
}

test("minor review issues can pass without unnecessary rewriting", () => {
  assert.equal(normalizeReview(reviewWithSeverity("minor")).approved, true);
});

test("major and blocking review issues require revision", () => {
  for (const severity of ["major", "blocking"] as const) {
    const review = normalizeReview(reviewWithSeverity(severity));
    assert.equal(review.approved, false);
    assert.match(review.revisionBrief, /修复这个问题/);
  }
});

test("scores below the acceptance threshold require revision", () => {
  const review = normalizeReview(
    ChapterReviewSchema.parse({
      score: 74,
      approved: true,
      strengths: [],
      issues: [],
      revisionBrief: "加强因果推进。",
    }),
  );
  assert.equal(review.approved, false);
});
