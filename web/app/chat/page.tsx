import ChatView from "./chat-view";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 md:py-20 flex flex-col">
      <header className="flex items-baseline justify-between mb-10">
        <div className="flex items-baseline gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <a href="/" className="text-2xl font-semibold tracking-tight hover:opacity-70 transition-opacity">
            Teller
          </a>
          <span className="text-muted text-sm">chat</span>
        </div>
        <span className="text-xs text-muted tabular-nums">sandbox · v0.1</span>
      </header>

      <ChatView />
    </div>
  );
}
