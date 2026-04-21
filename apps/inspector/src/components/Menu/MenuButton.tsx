import { twMerge } from "tailwind-merge";

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-haspopup"?: "menu" | "true";
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export const MenuButton = ({
  className,
  children,
  ref,
  ...props
}: MenuButtonProps) => {
  return (
    <button
      ref={ref}
      type="button"
      className={twMerge(
        "inline-flex items-center justify-center",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

MenuButton.displayName = "MenuButton";
