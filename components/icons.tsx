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

/** Show / expand details (Heroicons 20 solid “eye”). */
export function EyeIcon({
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
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Hide details (Heroicons 20 solid “eye-slash”). */
export function EyeSlashIcon({
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
        d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
        clipRule="evenodd"
      />
      <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
    </svg>
  );
}

export function PencilIcon({
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
        d="M5.433 13.917l1.262-3.155a4 4 0 0 1 .915-1.152l5.16-5.16a2.41 2.41 0 0 1 3.408 0l1.101 1.101a2.408 2.408 0 0 1 0 3.408l-5.16 5.16a4 4 0 0 1-2.152 1.915l-3.155 1.262a.75.75 0 0 1-.926-.926Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Open in full page / external navigation (Heroicons 20 solid “arrow-top-right-on-square”). */
export function ArrowTopRightOnSquareIcon({
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
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

