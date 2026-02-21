import { MessagingProvider } from "../../context/MessagingContext";
import { MessagingLayout } from "../../components/messaging/MessagingLayout";
import { ConversationList } from "../../components/messaging/ConversationList";
import { ChatPanel } from "../../components/messaging/ChatPanel";
import { CRMPanel } from "../../components/messaging/CRMPanel";

export default function MessagesScreen() {
  return (
    <MessagingProvider>
      <MessagingLayout
        leftPanel={<ConversationList />}
        centerPanel={<ChatPanel />}
        rightPanel={<CRMPanel />}
      />
    </MessagingProvider>
  );
}
