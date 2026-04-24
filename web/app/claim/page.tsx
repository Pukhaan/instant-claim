import ClaimWizard from "./claim-wizard";

export const dynamic = "force-dynamic";

// SnapClaim is intentionally rendered without the Teller chrome (no logo bar,
// no max-width container) — every screen owns the entire viewport for an
// app-like feel on iPhone. The wizard handles its own padding + safe areas.
export default function ClaimPage() {
  return <ClaimWizard />;
}
