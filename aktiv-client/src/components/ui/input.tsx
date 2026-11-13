"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const [visible, setVisible] = React.useState(false)
  const esClave = type === "password"
  const campo = (
    <InputPrimitive
      type={esClave && visible ? "text" : type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        esClave && "pr-11", className
      )}
      {...props}
    />
  )
  if (!esClave) return campo
  return <div className="relative min-w-0">
    {campo}
    <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} aria-controls={props.id} disabled={props.disabled} onClick={() => setVisible((anterior) => !anterior)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
      {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
    </button>
  </div>
}

export { Input }
