import ReceiptView from "./receipt-view";

export const dynamic = "force-dynamic";

export default function ReceiptPage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 md:py-20">
      <header className="flex items-baseline justify-between mb-10">
        <div className="flex items-baseline gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <a href="/" className="text-2xl font-semibold tracking-tight hover:opacity-70 transition-opacity">
            Teller
          </a>
          <span className="text-muted text-sm">receipts</span>
        </div>
        <span className="text-xs text-muted tabular-nums">sandbox · v0.1</span>
      </header>

      <section className="mb-8">
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
