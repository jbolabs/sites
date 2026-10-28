/**
 * The Assistant: a button in the admin's top bar that opens a side panel. The
 * panel is non-modal, so the editor stays usable while the assistant works; on
 * desktop it is a rounded pane beside the page card (see `assistant.css`).
 */
import { SparklesIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { AssistantChat } from "#assistant/assistant-chat.tsx";
import { useAssistantViewport } from "#assistant/hooks/use-assistant-viewport.ts";
import { useHeaderSlot } from "#assistant/hooks/use-header-slot.ts";
import { usePathname } from "#assistant/hooks/use-location.ts";
import { useMobileLayout } from "#assistant/hooks/use-mobile-layout.ts";
import { useSidePane } from "#assistant/hooks/use-side-pane.ts";
import { openEntryFromPath } from "#assistant/open-entry.ts";
import { Button } from "#assistant/ui/button.tsx";
import { Sheet, SheetContent } from "#assistant/ui/sheet.tsx";
import { TooltipProvider } from "#assistant/ui/tooltip.tsx";

import type { PanelConfig } from "../assistant/protocol.ts";

export const Assistant = ({
  config,
  host,
}: {
  readonly config: PanelConfig;
  /** The Assistant's own root element; the panel mounts inside it so its styles apply. */
  readonly host: HTMLElement;
}) => {
  const [open, setOpen] = useState(false);
  const mobile = useMobileLayout();
  useAssistantViewport(host, open && mobile);
  const slot = useHeaderSlot();
  const entry = openEntryFromPath(usePathname());
  useSidePane(open);
  // A phone panel covers the screen a reply's link just opened; a desktop pane sits beside it.
  const closeOnPhone = useCallback(() => {
    if (mobile) {
      setOpen(false);
    }
  }, [mobile]);

  return (
    <TooltipProvider>
      {slot !== null &&
        createPortal(
          <Button
            aria-expanded={open}
            aria-label="Assistant"
            data-admin-icon-action=""
            onClick={() => {
              setOpen((value) => !value);
            }}
            size="icon"
            title="Assistant"
            variant={open ? "secondary" : "ghost"}
          >
            <SparklesIcon aria-hidden="true" />
            <span data-admin-action-label="">Assistant</span>
          </Button>,
          slot
        )}
      <Sheet
        disablePointerDismissal
        modal={mobile}
        onOpenChange={setOpen}
        open={open}
      >
        <SheetContent
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
          container={host}
          // Let phone users read first without immediately covering the panel with a keyboard.
          initialFocus={() =>
            host.querySelector(mobile ? "[data-slot=sheet-close]" : "textarea")
          }
          showCloseButton={false}
          showOverlay={mobile}
        >
          <AssistantChat
            config={config}
            entry={entry}
            onOpenLink={closeOnPhone}
          />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
};
