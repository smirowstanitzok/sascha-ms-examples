// src/collect.ts
// Reads HTTP/WebSocket APIs, Function URLs and REST methods (read-only).
import { ApiGatewayV2Client, GetApisCommand, GetRoutesCommand } from '@aws-sdk/client-apigatewayv2';
import { APIGatewayClient, GetRestApisCommand, GetResourcesCommand } from '@aws-sdk/client-api-gateway';
import { LambdaClient, ListFunctionsCommand, ListFunctionUrlConfigsCommand } from '@aws-sdk/client-lambda';
import type { FunctionUrlInfo, HttpApiInfo, RestMethodInfo } from './gaps.ts';

export async function collectHttpApis(client: ApiGatewayV2Client): Promise<HttpApiInfo[]> {
  const result: HttpApiInfo[] = [];
  let nextToken: string | undefined;
  do {
    const page = await client.send(new GetApisCommand({ NextToken: nextToken }));
    for (const api of page.Items ?? []) {
      const routes: HttpApiInfo['routes'] = [];
      let routeToken: string | undefined;
      do {
        const r = await client.send(new GetRoutesCommand({ ApiId: api.ApiId!, NextToken: routeToken }));
        for (const route of r.Items ?? []) {
          routes.push({ routeKey: route.RouteKey ?? '', authorizationType: route.AuthorizationType ?? 'NONE' });
        }
        routeToken = r.NextToken;
      } while (routeToken);
      result.push({
        apiId: api.ApiId!,
        name: api.Name ?? api.ApiId!,
        protocolType: api.ProtocolType === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP',
        endpoint: api.ApiEndpoint ?? '',
        executeApiDisabled: api.DisableExecuteApiEndpoint ?? false,
        routes,
      });
    }
    nextToken = page.NextToken;
  } while (nextToken);
  return result;
}

export async function collectFunctionUrls(client: LambdaClient): Promise<FunctionUrlInfo[]> {
  const result: FunctionUrlInfo[] = [];
  let marker: string | undefined;
  do {
    const page = await client.send(new ListFunctionsCommand({ Marker: marker }));
    for (const fn of page.Functions ?? []) {
      const urls = await client.send(new ListFunctionUrlConfigsCommand({ FunctionName: fn.FunctionName! }));
      for (const cfg of urls.FunctionUrlConfigs ?? []) {
        result.push({
          functionName: fn.FunctionName!,
          url: cfg.FunctionUrl ?? '',
          authType: cfg.AuthType === 'AWS_IAM' ? 'AWS_IAM' : 'NONE',
        });
      }
    }
    marker = page.NextMarker;
  } while (marker);
  return result;
}

export async function collectRestMethods(client: APIGatewayClient): Promise<RestMethodInfo[]> {
  const result: RestMethodInfo[] = [];
  let position: string | undefined;
  do {
    const apis = await client.send(new GetRestApisCommand({ position, limit: 100 }));
    for (const api of apis.items ?? []) {
      let resPosition: string | undefined;
      do {
        const res = await client.send(
          new GetResourcesCommand({ restApiId: api.id!, position: resPosition, limit: 500 }),
        );
        for (const resource of res.items ?? []) {
          for (const httpMethod of Object.keys(resource.resourceMethods ?? {})) {
            result.push({ apiId: api.id!, apiName: api.name ?? api.id!, path: resource.path ?? '/', httpMethod });
          }
        }
        resPosition = res.position;
      } while (resPosition);
    }
    position = apis.position;
  } while (position);
  return result;
}
