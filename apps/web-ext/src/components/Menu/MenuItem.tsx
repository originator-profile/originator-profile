import clsx from "clsx";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  role?: "menuitem";
  selected?: boolean;
  active?: boolean;
  value: string;
  ref?: React.Ref<HTMLButtonElement>;
  variant?: "button" | "link";
  to?: string;
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
          className={clsx(
            "w-full py-2 text-left text-sm",
            "flex items-center",
            "focus:outline-none",
            { "font-bold": active },
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
          className={clsx(
            "w-full py-2 text-left text-sm",
            "flex items-center",
            "focus:outline-none",
            {
              "font-bold": active, // Active state shows bold text like original
            },
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
