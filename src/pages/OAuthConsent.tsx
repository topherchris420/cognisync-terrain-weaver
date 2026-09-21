import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthorizationDetails = {
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  client?: {
    name?: string;
    redirect_uris?: string[];
  };
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "this client";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md glass-panel">
        {error ? (
          <CardHeader>
            <CardTitle>Authorization failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        ) : !details ? (
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
            <CardDescription>Fetching this authorization request.</CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Connect {clientName} to Urban Resilience</CardTitle>
              <CardDescription>
                {clientName} will be able to call this app's terrain-scan tools while you are signed in,
                including creating, updating and deleting scans you own.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1">
                {details?.client?.redirect_uris?.[0] && (
                  <li>Redirect: {details.client.redirect_uris[0]}</li>
                )}
                {String(details?.scope ?? "")
                  .split(" ")
                  .filter(Boolean)
                  .map((s: string) => (
                    <li key={s}>Requested permission: {s}</li>
                  ))}
                <li>This does not bypass this app's permissions or backend policies.</li>
              </ul>
              <div className="flex gap-3">
                <Button disabled={busy} onClick={() => decide(true)}>
                  Approve
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>
                  Cancel connection
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}