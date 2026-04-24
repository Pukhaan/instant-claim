import ReceiptView from "./receipt-view";
import TopNav from "../top-nav";

export const dynamic = "force-dynamic";

export default function ReceiptPage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 md:py-14">
      <TopNav current="receipt" />

      <section className="mb-8 md:mb-10">
        <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
          Snap a receipt. Teller categorises it.
        </h1>
        <p className="text-pretty mt-3 text-muted max-w-xl leading-relaxed">
          Upload a photo. Claude Vision reads merchant, total, and line items, then matches it to the
          corresponding bunq transaction. Confirm and it&apos;s labelled forever.
        </p>
      </section>

      <ReceiptView />
    </div>
  );
}
