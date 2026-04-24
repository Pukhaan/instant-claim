import ClaimWizard from "./claim-wizard";
import ClaimHeader from "./claim-header";

export const dynamic = "force-dynamic";

export default function ClaimPage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 md:py-12 flex flex-col min-h-screen">
      <ClaimHeader />
      <ClaimWizard />
    </div>
  );
}
