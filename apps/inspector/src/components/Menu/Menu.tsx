import { useCallback } from "react";
import { twMerge } from "tailwind-merge";
import "./Menu.css";

interface MenuProps extends React.HTMLAttributes<HTMLUListElement> {
  role?: "menu";
  "aria-labelledby"?: string;
  isOpen?: boolean;
  hasKeyboardFocus?: boolean;
  ref?: React.Ref<HTMLUListElement>;
}

export const Menu = ({
  className,
  children,
  isOpen = false,
  hasKeyboardFocus = false,
  ref,
  ...props
}: MenuProps) => {
  // Combine refs using a callback ref
  const setRefs = useCallback(
    (node: HTMLUListElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  return (
    <ul
      ref={setRefs}
      data-open={isOpen}
      className={twMerge(
        "menu-container",
        "absolute z-20 min-w-0 rounded-lg bg-white py-2 shadow-lg",
        "focus:outline-none",
        hasKeyboardFocus && "ring-2 ring-blue-500",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
};

Menu.displayName = "Menu";
