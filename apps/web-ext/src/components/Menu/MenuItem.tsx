import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { twMerge } from "tailwind-merge";

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  role?: "menuitem";
  selected?: boolean;
  active?: boolean;
  value: string;
  ref?: React.Ref<HTMLButtonElement>;
  variant?: "button" | "link";
  to?: string;
  testId?: string;
}

export const MenuItem = ({
  className,
  children,
  selected: _selected = false,
  active = false,
  value: _value,
  ref,
  variant = "button",
  to,
  testId,
  ...props
}: MenuItemProps) => {
  const internalRef = useRef<HTMLButtonElement>(null);

  // Combine refs
  const setRefs = (node: HTMLButtonElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  // Sync active state with DOM focus
  useEffect(() => {
    if (active && internalRef.current) {
      internalRef.current.focus();
    }
  }, [active]);
  return (
    <li role="none">
      {variant === "link" && to ? (
        <Link
          to={to}
          role="menuitem"
          data-testid={testId}
          className={twMerge(
            "w-full py-2 text-left text-sm",
            "flex items-center",
            "focus:outline-none",
            active && "font-bold",
            className,
          )}
        >
          {children}
        </Link>
      ) : (
        <button
          ref={setRefs}
          type="button"
          role="menuitem"
          className={twMerge(
            "w-full py-2 text-left text-sm",
            "flex items-center",
            "focus:outline-none",
            active && "font-bold", // Active state shows bold text like original
            className,
          )}
          {...props}
        >
          {children}
        </button>
      )}
    </li>
  );
};

MenuItem.displayName = "MenuItem";
