import BunqHome from "./bunq-home";

export const dynamic = "force-dynamic";

// Root route is the bunq-style home — matches Finn-Insurance Figma 17:195.
// The chat-first interface is still available at /chat.
export default function Home() {
  return <BunqHome />;
}
