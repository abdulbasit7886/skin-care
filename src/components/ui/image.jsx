import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Plain image with sensible defaults. `fittingType="fit"` letterboxes the image
 * (object-contain); `"fill"` (default) crops to cover. A broken or missing
 * source renders a neutral placeholder instead of a broken-image icon.
 */
const Image = React.forwardRef(
  ({ src, alt = "", fittingType = "fill", className, onError, ...props }, ref) => {
    const [failed, setFailed] = React.useState(false)
    React.useEffect(() => setFailed(false), [src])

    if (!src || failed) {
      return (
        <span
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          className={cn("inline-block bg-muted", className)}
          data-empty-image
        />
      )
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(fittingType === "fit" ? "object-contain" : "object-cover", className)}
        onError={(event) => {
          setFailed(true)
          onError?.(event)
        }}
        {...props}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
