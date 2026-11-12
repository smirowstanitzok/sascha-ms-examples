// src/my-sessions.ts
import {
  CognitoIdentityProviderClient,
  ListUserSessionsCommand,
  RevokeUserSessionCommand,
  type SessionDescriptionType,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { isValidSessionId, sortSessions, toView } from "./sessions";

const cognito = new CognitoIdentityProviderClient({});

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// The JWT authorizer has already checked the token, we pass it on to Cognito
function accessToken(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const header = event.headers.authorization ?? "";
  return header.replace(/^Bearer\s+/i, "");
}

async function loadAll(token: string): Promise<SessionDescriptionType[]> {
  const all: SessionDescriptionType[] = [];
  let nextToken: string | undefined;
  do {
    const page = await cognito.send(
      new ListUserSessionsCommand({ AccessToken: token, NextToken: nextToken }),
    );
    all.push(...(page.Sessions ?? []));
    nextToken = page.NextToken;
  } while (nextToken);
  return all;
}

// Revoked session: the JWT is still valid, but Cognito rejects it
function isRevoked(error: unknown): boolean {
  return (error as Error).name === "NotAuthorizedException";
}

// GET /sessions
export async function list(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  try {
    const sessions = await loadAll(accessToken(event));
    return json(200, { sessions: sortSessions(sessions.map(toView)) });
  } catch (error) {
    if (isRevoked(error)) return json(401, { message: "Session ended, please sign in again" });
    throw error;
  }
}

// DELETE /sessions/{id}
export async function revoke(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const id = event.pathParameters?.id;
  if (!isValidSessionId(id)) return json(400, { message: "Invalid session ID" });

  const token = accessToken(event);
  let own: SessionDescriptionType[];
  try {
    own = await loadAll(token);
  } catch (error) {
    if (isRevoked(error)) return json(401, { message: "Session ended, please sign in again" });
    throw error;
  }
  const target = own.find((s) => s.SessionId === id);
  if (!target) return json(404, { message: "Session not found" });
  if (target.IsCurrentSession) {
    // Cognito rejects this anyway, we return a clear answer
    return json(409, { message: "Use “Sign out” to end your current session." });
  }

  await cognito.send(
    new RevokeUserSessionCommand({
      AccessToken: token,
      SessionId: id,
      // For an SSO session this also ends every app session that came from it
      RevokeAssociatedSessions: "LINKED",
    }),
  );
  return { statusCode: 204 };
}
