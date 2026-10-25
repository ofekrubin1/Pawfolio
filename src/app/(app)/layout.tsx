import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";
import { PushRegistrar } from "@/components/PushRegistrar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <PushRegistrar />
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
