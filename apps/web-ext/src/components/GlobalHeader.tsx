import { useParams } from "react-router";
import { Header, _ } from "@originator-profile/ui";
import { buildDetailUrl } from "../utils/routes";
import { Menu, MenuButton, MenuItem, useMenuButton } from "./Menu";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

function GlobalHeader({ className, children }: Props) {
  const { tabId } = useParams<{ tabId: string }>();
  const {
    isOpen,
    activeIndex,
    isKeyboardNavigation,
    buttonRef,
    menuRef,
    setItemRef,
    buttonProps,
    menuProps,
    toggleMenu,
    handleButtonKeyDown,
    handleMenuKeyDown,
    handleItemMouseEnter,
  } = useMenuButton({
    items: ["detail"],
    onItemSelect: (value) => {
      if (value === "detail") {
        toggleMenu();
      }
    },
  });

  return (
    <Header className={twMerge("border-gray-200", className)}>
      {children}
      <div className="ml-auto relative">
        <MenuButton
          ref={buttonRef}
          className="p-2 hover:bg-gray-100 rounded"
          onClick={toggleMenu}
          onKeyDown={handleButtonKeyDown}
          {...buttonProps}
        >
          <Icon
            icon="mdi:ellipsis-vertical"
            className="w-5 h-5 text-gray-700"
          />
        </MenuButton>

        {isOpen && (
          <Menu
            ref={menuRef}
            isOpen={isOpen}
            hasKeyboardFocus={isKeyboardNavigation && activeIndex !== -1}
            className="absolute right-0 mt-2 min-w-40"
            {...menuProps}
          >
            <MenuItem
              ref={setItemRef(0)}
              value="detail"
              active={activeIndex === 0}
              onKeyDown={(e) => handleMenuKeyDown(e, "detail")}
              onMouseEnter={() => handleItemMouseEnter(0)}
              variant="link"
              to={buildDetailUrl(tabId ?? "")}
              className="px-4 py-2 hover:bg-gray-100 font-light"
            >
              {_("DetailInfo")}
            </MenuItem>
          </Menu>
        )}
      </div>
    </Header>
  );
}

export default GlobalHeader;
