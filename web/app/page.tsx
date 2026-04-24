import TopNav from "./top-nav";
import ChatView from "./chat/chat-view";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 md:py-14 flex flex-col">
      <TopNav current="home" />
      <ChatView hero />
    </div>
  );
}
