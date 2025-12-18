import { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export type ExternalLinkProps = {
  className?: string;
  href?: string;
  children: ReactNode;
};

export function ExternalLink(props: ExternalLinkProps) {
  return (
    <a
      {...props}
      className={twMerge("text-blue-600 hover:underline", props.className)}
      target="_blank"
      rel="noreferrer"
    >
      {props.children}
    </a>
  );
}
