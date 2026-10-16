/**
 * Google sign-in for editing. Uses Google Identity Services to get a short-lived
 * access token that can edit spreadsheets. The token lives in memory only.
 */
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

let client: TokenClient | undefined;
// Kept for this browser tab only, so a reload doesn't ask to sign in again within the hour.
const TOKEN_KEY = "miniatures-dashboard:google-token";
let token: { value: string; expires: number } | undefined = (() => {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as { value: string; expires: number } | null;
    return t && t.expires > Date.now() ? t : undefined;
  } catch {
    return undefined;
  }
})();
const remember = () => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: sign in again after a reload */
  }
};
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | undefined;

export const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const sheetId = import.meta.env.VITE_SHEET_ID as string | undefined;
export const editingAvailable = !!(clientId && sheetId);

function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google sign-in. Check your connection and try again."));
    document.head.append(s);
  });
}

async function getClient(): Promise<TokenClient> {
  if (client) return client;
  if (!clientId) throw new Error("Editing isn't set up on this site yet.");
  await loadScript();
  client = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (r) => {
      if (r.access_token) {
        token = { value: r.access_token, expires: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
        remember();
        pending?.resolve(r.access_token);
      } else {
        pending?.reject(new Error(r.error_description || "Google sign-in didn't complete."));
      }
      pending = undefined;
    },
    error_callback: (e) => {
      pending?.reject(new Error(e.type === "popup_closed" ? "Sign-in was closed before it finished." : "Google sign-in didn't complete."));
      pending = undefined;
    },
  });
  return client;
}

/** A valid token, asking Google for one when needed. Call from a click so the sign-in popup is allowed. */
export async function signIn(prompt: "" | "consent" = ""): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  const c = await getClient();
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    c.requestAccessToken({ prompt });
  });
}

export function currentToken(): string | undefined {
  return token && token.expires > Date.now() ? token.value : undefined;
}

export function signOut() {
  if (token) window.google?.accounts.oauth2.revoke(token.value);
  token = undefined;
  remember();
}
