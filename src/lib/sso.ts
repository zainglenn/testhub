import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/lib/workspace";

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function getSsoSettings() {
  const workspace = await getWorkspace();
  const config = await prisma.ssoConfig.findUnique({
    where: { workspaceId: workspace.id },
  });

  if (
    !config ||
    !config.enabled ||
    !config.issuerUrl ||
    !config.clientId ||
    !config.clientSecret
  ) {
    return null;
  }
  return config;
}

export type OidcEndpoints = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
};

export async function discover(issuer: string): Promise<OidcEndpoints> {
  const base = issuer.replace(/\/$/, "");
  const response = await fetch(`${base}/.well-known/openid-configuration`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OIDC discovery failed (${response.status})`);
  }

  const data = (await response.json()) as Partial<OidcEndpoints>;
  if (!data.authorization_endpoint || !data.token_endpoint) {
    throw new Error("OIDC discovery response is missing endpoints");
  }

  return {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
    userinfo_endpoint: data.userinfo_endpoint,
  };
}

export function base64url(input: Buffer): string {
  return input.toString("base64url");
}
