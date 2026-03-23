import { LoaderIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("xs:size-5 animate-spin sm:size-7", className)}
      {...props}
    />
  );
}

export { Spinner };
