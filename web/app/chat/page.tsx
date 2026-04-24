import ChatView from "./chat-view";
import TopNav from "../top-nav";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 md:py-14 flex flex-col">
      <TopNav current="chat" />
      <ChatView />
    </div>
  );
}
