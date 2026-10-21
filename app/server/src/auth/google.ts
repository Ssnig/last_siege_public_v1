import { OAuth2Client } from "google-auth-library";
import { googleClientId } from "./config.js";
import { HttpError } from "./errors.js";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

let client: OAuth2Client | null = null;
let clientId: string | null = null;

function getClient(): { client: OAuth2Client; clientId: string } {
  const configuredId = googleClientId();
  if (!configuredId) {
    throw new HttpError(503, "Google sign-in is not configured on this server.");
  }
  if (!client || clientId !== configuredId) {
    client = new OAuth2Client(configuredId);
    clientId = configuredId;
  }
  return { client, clientId: configuredId };
}

/**
 * Verifies a Google Identity Services credential (an ID token) and returns the
 * profile it asserts.
 */
export async function verifyGoogleCredential(
  credential: string,
): Promise<GoogleProfile> {
  const { client: oauthClient, clientId: audience } = getClient();

  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience,
    });
  } catch {
    throw new HttpError(401, "Invalid Google credential.");
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new HttpError(401, "Google did not return an email address.");
  }
  if (!payload.email_verified) {
    throw new HttpError(401, "Your Google email address is not verified.");
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || payload.email.split("@")[0],
    picture: payload.picture?.trim() || "",
  };
}
