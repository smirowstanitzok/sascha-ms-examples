// src/support.ts
import {
  AdminListUserSessionsCommand,
  AdminRevokeUserSessionCommand,
  CognitoIdentityProviderClient,
  type SessionDescriptionType,
} from "@aws-sdk/client-cognito-identity-provider";
import { toView } from "./sessions";

const cognito = new CognitoIdentityProviderClient({});
const userPoolId = process.env.USER_POOL_ID ?? "";

export interface SupportRequest {
  username: string;
  // Without a list, all browser sign-ins and their app sessions are ended
  sessionIds?: string[];
}

async function loadAll(username: string): Promise<SessionDescriptionType[]> {
  const all: SessionDescriptionType[] = [];
  let nextToken: string | undefined;
  do {
    const page = await cognito.send(
      new AdminListUserSessionsCommand({ UserPoolId: userPoolId, Username: username, NextToken: nextToken }),
    );
    all.push(...(page.Sessions ?? []));
    nextToken = page.NextToken;
  } while (nextToken);
  return all;
}

// Invoked directly by the support team (no HTTP endpoint)
export async function handler(request: SupportRequest) {
  if (!request.username) throw new Error("username is missing");
  const sessions = await loadAll(request.username);

  const targets = request.sessionIds?.length
    ? sessions.filter((s) => request.sessionIds!.includes(s.SessionId ?? ""))
    : sessions.filter((s) => s.SessionType === "SSO" || !s.OriginSessionId);

  // SSO sessions first: LINKED takes their app sessions along
  targets.sort((a, b) => (a.SessionType === "SSO" ? -1 : 0) - (b.SessionType === "SSO" ? -1 : 0));

  const revoked: string[] = [];
  for (const s of targets) {
    try {
      await cognito.send(
        new AdminRevokeUserSessionCommand({
          UserPoolId: userPoolId,
          Username: request.username,
          SessionId: s.SessionId,
          RevokeAssociatedSessions: "LINKED",
        }),
      );
      revoked.push(s.SessionId ?? "");
    } catch (error) {
      // Already ended through a linked session? Then all is well.
      if ((error as Error).name !== "ResourceNotFoundException") throw error;
    }
  }

  return {
    before: sessions.map(toView),
    revoked,
  };
}
