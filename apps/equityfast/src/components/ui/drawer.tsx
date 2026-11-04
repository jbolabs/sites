"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { pinDrawerToPage, useDrawerHeight } from "@jakebodea/site-ui/drawer";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A floating bottom sheet (Base UI Drawer) in shadcn's shape. The motion and
 * shape live in `@jakebodea/site-ui/drawer.css`, and its height follows the
 * content (`useDrawerHeight`); variants here set color and spacing.
 * Phones reach this through `ResponsiveDialog` rather than directly.
 */
function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

const drawerContentVariants = {
  default: "bg-popover text-popover-foreground",
  /** The multi-step application on phones. */
  application: "bg-white text-ink",
} as const;

const drawerBodyVariants = {
  default: "p-4",
  application: "p-5",
} as const;

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  variant = "default",
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  /** Screen-reader label for the close button, in the page's language. */
  closeLabel?: string;
  variant?: keyof typeof drawerContentVariants;
}) {
  const { measure, style } = useDrawerHeight();
  return (
    // Keeps the focused field above the software keyboard in form sheets.
    <DrawerPrimitive.VirtualKeyboardProvider>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop
          ref={pinDrawerToPage}
          data-slot="drawer-overlay"
          className="drawer-backdrop"
        />
        <DrawerPrimitive.Viewport
          ref={pinDrawerToPage}
          className="drawer-viewport"
        >
          <DrawerPrimitive.Popup
            data-slot="drawer-content"
            className={cn(
              "drawer-popup",
              drawerContentVariants[variant],
              className
            )}
            {...props}
          >
            <div className="drawer-body" style={style}>
              <DrawerPrimitive.Content
                ref={measure}
                className={drawerBodyVariants[variant]}
              >
                {children}
              </DrawerPrimitive.Content>
            </div>
            {showCloseButton && (
              <DrawerPrimitive.Close
                data-slot="drawer-close"
                render={
                  <Button
                    variant="ghost"
                    // Above and opaque, so a pinned header or scrolled body passes under it.
                    className="absolute top-3 right-3 z-20 bg-inherit"
                    size="icon-sm"
                  />
                }
              >
                <XIcon />
                <span className="sr-only">{closeLabel}</span>
              </DrawerPrimitive.Close>
            )}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.VirtualKeyboardProvider>
  );
}

const drawerTitleVariants = {
  default: "font-medium",
  /** Large ink question heading, leaving room for the close button. */
  application:
    "text-ink pr-10 text-[clamp(1.5rem,5vw,1.875rem)] leading-tight font-medium tracking-tight",
} as const;

function DrawerTitle({
  className,
  variant = "default",
  ...props
}: DrawerPrimitive.Title.Props & {
  variant?: keyof typeof drawerTitleVariants;
}) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-base leading-none",
        drawerTitleVariants[variant],
        className
      )}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle };
