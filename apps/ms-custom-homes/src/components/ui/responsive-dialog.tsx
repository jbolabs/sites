"use client";

import { createContext, use, useSyncExternalStore } from "react";
import type { ComponentProps, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

/**
 * A dialog from `sm` up and a bottom-sheet drawer below it: phones never get
 * a centered dialog (`local/no-mobile-dialog` keeps it that way). Content,
 * title, and description pick their half from the root.
 */
const DESKTOP_QUERY = "(min-width: 640px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};

/** Server render assumes desktop; the closed dialog renders nothing either way. */
const useIsDesktop = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  );

const DesktopContext = createContext(true);

function ResponsiveDialog({
  children,
  onOpenChange,
  open,
}: {
  readonly children: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const desktop = useIsDesktop();
  return (
    <DesktopContext value={desktop}>
      {desktop ? (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
          }}
        >
          {children}
        </Dialog>
      ) : (
        <Drawer
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
          }}
        >
          {children}
        </Drawer>
      )}
    </DesktopContext>
  );
}

type Variant = NonNullable<
  ComponentProps<typeof DialogContent>["variant"] &
    ComponentProps<typeof DrawerContent>["variant"]
>;

function ResponsiveDialogContent({
  variant,
  ...props
}: Omit<ComponentProps<"div">, "ref" | "className"> & {
  readonly closeLabel?: string;
  readonly className?: string;
  readonly variant?: Variant;
}) {
  return use(DesktopContext) ? (
    <DialogContent variant={variant} {...props} />
  ) : (
    <DrawerContent variant={variant} {...props} />
  );
}

function ResponsiveDialogTitle({
  variant,
  ...props
}: ComponentProps<typeof DialogTitle>) {
  return use(DesktopContext) ? (
    <DialogTitle variant={variant} {...props} />
  ) : (
    <DrawerTitle variant={variant} {...props} />
  );
}

function ResponsiveDialogDescription(
  props: ComponentProps<typeof DialogDescription>
) {
  return use(DesktopContext) ? (
    <DialogDescription {...props} />
  ) : (
    <DrawerDescription {...props} />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
};
