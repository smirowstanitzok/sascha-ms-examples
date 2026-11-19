// test/authorization-id.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAuthorizationId, isAccessDenied } from "../src/authorization-id";

const message =
  "User: arn:aws:sts::111122223333:assumed-role/bike-returns-role/report is not authorized to perform: " +
  "sqs:SendMessage on resource: arn:aws:sqs:eu-central-1:111122223333:bike-returns " +
  "because no identity-based policy allows the sqs:SendMessage action. " +
  "Go to https://eu-central-1.console.aws.amazon.com/iam/home?region=eu-central-1#/authorization-details/EXAMPLEabc123def456 " +
  "for complete details, or call the GetRequestAuthorizationDetails API with the following authorization id: EXAMPLEabc123def456";

test("finds the ID in the text part of the message", () => {
  assert.equal(extractAuthorizationId(message), "EXAMPLEabc123def456");
});

test("finds the ID in the console link alone", () => {
  const link = "see https://eu-central-1.console.aws.amazon.com/iam/home#/authorization-details/EXAMPLExyz987";
  assert.equal(extractAuthorizationId(link), "EXAMPLExyz987");
});

test("returns undefined for older messages without an ID", () => {
  assert.equal(extractAuthorizationId("User: … is not authorized to perform: s3:GetObject"), undefined);
});

test("recognizes AccessDenied by name or HTTP status", () => {
  const byName = Object.assign(new Error("x"), { name: "AccessDeniedException" });
  const byStatus = Object.assign(new Error("x"), { name: "Forbidden", $metadata: { httpStatusCode: 403 } });
  assert.equal(isAccessDenied(byName), true);
  assert.equal(isAccessDenied(byStatus), true);
  assert.equal(isAccessDenied(new Error("timeout")), false);
});
