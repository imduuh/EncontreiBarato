"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default" | "lg"
}) {
  const trackSizeClasses = {
    sm: "h-[14px] w-[24px]",
    default: "h-[18.4px] w-[32px]",
    lg: "h-7 w-12",
  }[size]

  const thumbSizeClasses = {
    sm: "size-3 data-[state=checked]:translate-x-[10px]",
    default: "size-4 data-[state=checked]:translate-x-[14px]",
    lg: "size-5 translate-x-1 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-1",
  }[size]

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-[state=unchecked]:bg-input/80",
        trackSizeClasses,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=unchecked]:translate-x-0 dark:bg-foreground dark:data-[state=checked]:bg-primary-foreground",
          thumbSizeClasses
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
