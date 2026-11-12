// test/sessions.test.ts
import { mockClient } from "aws-sdk-client-mock";
import {
  CognitoIdentityProviderClient,
  ListUserSessionsCommand,
  RevokeUserSessionCommand,
  type SessionDescriptionType,
} from "@aws-sdk/client-cognito-identity-provider";
import { beforeEach, describe, expect, it } from "vitest";
import { isValidSessionId, maskIp, sortSessions, toView } from "../src/sessions";
import { list, revoke } from "../src/my-sessions";

const cognito = mockClient(CognitoIdentityProviderClient);
const phone = "tkn" + "a".repeat(25);
const laptop = "sso" + "b".repeat(25);

const event = (id?: string) =>
  ({
    headers: { authorization: "Bearer test-token" },
    pathParameters: id ? { id } : undefined,
  }) as never;

beforeEach(() => {
  cognito.reset();
  cognito.on(ListUserSessionsCommand).resolves({
    Sessions: [
      { SessionId: laptop, SessionType: "SSO", LastActiveDate: new Date("2026-11-10T08:00:00Z") },
      {
        SessionId: phone,
        SessionType: "TOKEN",
        IsCurrentSession: true,
        DeviceType: "iOS, Speichenwerk-App",
        LastIPAddress: "203.0.113.42",
        LastLocation: { City: "Hamburg", Country: "Germany" },
        LastActiveDate: new Date("2026-11-12T07:00:00Z"),
      },
    ],
  });
});

describe("helpers", () => {
  it("masks IP addresses", () => {
    expect(maskIp("203.0.113.42")).toBe("203.0.x.x");
    expect(maskIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:85a3:…");
    expect(maskIp(undefined)).toBe("unknown");
  });

  it("validates session IDs", () => {
    expect(isValidSessionId(phone)).toBe(true);
    expect(isValidSessionId("abc")).toBe(false);
  });

  it("shows the current session first", () => {
    const raw: SessionDescriptionType[] = [
      { SessionId: laptop, SessionType: "SSO" },
      { SessionId: phone, IsCurrentSession: true },
    ];
    const views = sortSessions(raw.map(toView));
    expect(views[0].id).toBe(phone);
    expect(views[1].type).toBe("Browser sign-in");
  });
});

describe("endpoints", () => {
  it("lists sessions with a masked IP", async () => {
    const res = (await list(event())) as { statusCode: number; body: string };
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.sessions[0]).toMatchObject({ current: true, ip: "203.0.x.x", location: "Hamburg, Germany" });
    expect(cognito.commandCalls(ListUserSessionsCommand)[0].args[0].input.AccessToken).toBe("test-token");
  });

  it("refuses to end the current session", async () => {
    const res = (await revoke(event(phone))) as { statusCode: number };
    expect(res.statusCode).toBe(409);
    expect(cognito.commandCalls(RevokeUserSessionCommand)).toHaveLength(0);
  });

  it("ends another session including linked sessions", async () => {
    cognito.on(RevokeUserSessionCommand).resolves({});
    const res = (await revoke(event(laptop))) as { statusCode: number };
    expect(res.statusCode).toBe(204);
    expect(cognito.commandCalls(RevokeUserSessionCommand)[0].args[0].input).toMatchObject({
      SessionId: laptop,
      RevokeAssociatedSessions: "LINKED",
    });
  });

  it("returns 401 when the session has already ended", async () => {
    const revoked = Object.assign(new Error("Access Token has been revoked"), { name: "NotAuthorizedException" });
    cognito.on(ListUserSessionsCommand).rejects(revoked);
    const res = (await list(event())) as { statusCode: number };
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for unknown IDs", async () => {
    const res = (await revoke(event("tkn" + "z".repeat(25)))) as { statusCode: number };
    expect(res.statusCode).toBe(404);
  });
});
