import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon, GripHorizontal } from "lucide-react"

import { cn } from '~/lib/core'

/**
 * Dialog Components from Radix UI
 * 
 * NOTE: DialogTitle and DialogDescription are REQUIRED for accessibility.
 * If you need to hide them visually, use the VisuallyHidden component:
 * 
 * import { VisuallyHidden } from "~/components/ui/visually-hidden"
 * 
 * <DialogTitle asChild>
 *   <VisuallyHidden>Dialog Title</VisuallyHidden>
 * </DialogTitle>
 */

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
    resizable?: boolean
  }
>(({ className, children, showCloseButton = true, resizable = false, style, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const [size, setSize] = React.useState<{ width?: number; height?: number }>({})
  const [hasResized, setHasResized] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const isResizing = React.useRef(false)

  // Merge refs
  React.useImperativeHandle(ref, () => contentRef.current!)

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    setHasResized(true)
    
    const startX = e.pageX
    const startY = e.pageY
    const startWidth = contentRef.current?.offsetWidth || 0
    const startHeight = contentRef.current?.offsetHeight || 0

    // Capture initial size when starting to ensure smooth transition
    if (!hasResized) {
      setSize({ width: startWidth, height: startHeight })
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      
      // Calculate delta from center (since it's translated -50%)
      const deltaX = (e.pageX - startX) * 2
      const deltaY = (e.pageY - startY) * 2
      
      const newWidth = Math.max(300, startWidth + deltaX)
      const newHeight = Math.max(200, startHeight + deltaY)

      setSize({
        width: newWidth,
        height: newHeight
      })
    }

    const onMouseUp = () => {
      isResizing.current = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.body.style.cursor = "nwse-resize"
  }, [hasResized])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        data-autofill-ignore="true"
        tabIndex={-1}
        onOpenAutoFocus={(e) => {
          if (onOpenAutoFocus) onOpenAutoFocus(e)
          
          // Enterprise Level 8: Focus Management Fix
          // Prevents Chrome "Blocked aria-hidden on an element because its descendant retained focus"
          // by ensuring the focus transition is handled before aria-hidden logic fully traps the UI.
          if (!e.defaultPrevented) {
             // We allow the default but we ensure the content can receive focus
             contentRef.current?.focus();
          }
        }}
        onCloseAutoFocus={(e) => {
          if (onCloseAutoFocus) onCloseAutoFocus(e)
        }}
        aria-describedby={undefined}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200 outline-none h-fit max-h-[96vh] flex flex-col",
          // Only add default width constraints if no width is provided in className
          !className?.includes('max-w-') && !className?.includes('w-') && "w-full max-w-[calc(100%-2rem)] sm:max-w-lg",
          // Default padding only if no p- class is provided
          !className?.match(/\bp-\d+/) && "p-6",
          resizable && isResizing.current && "transition-none", 
          className
        )}
        style={{
          ...style,
          width: hasResized && size.width ? `${size.width}px` : undefined,
          height: hasResized && size.height ? `${size.height}px` : undefined,
          pointerEvents: 'auto', // Ensure pointer events are active
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {resizable && (
          <div
            onMouseDown={startResizing}
            className="absolute -bottom-1 -right-1 cursor-nwse-resize p-3 z-[60]"
            title="Redimensionează"
          >
            <div className="w-4 h-4 text-slate-400 hover:text-blue-600 transition-colors">
              <GripHorizontal className="h-full w-full rotate-45" />
            </div>
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg leading-none font-semibold", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
