import type { ComponentPropsWithoutRef } from "react";

export function TrashIcon({
  className = "h-4 w-4",
  ...props
}: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M7.5 2.75A1.75 1.75 0 0 0 5.75 4.5V5h-2a.75.75 0 0 0 0 1.5h.724l.65 10.47A2.25 2.25 0 0 0 7.37 19h5.26a2.25 2.25 0 0 0 2.246-2.03l.65-10.47h.724a.75.75 0 0 0 0-1.5h-2v-.5A1.75 1.75 0 0 0 12.5 2.75h-5ZM7.25 5v-.5a.25.25 0 0 1 .25-.25h5a.25.25 0 0 1 .25.25V5h-5.5Zm-.576 1.5.642 10.35a.75.75 0 0 0 .748.65h3.186a.75.75 0 0 0 .75-.75V7.5a.75.75 0 0 0-1.5 0V16H8.78L8.167 6.5h-1.493Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

