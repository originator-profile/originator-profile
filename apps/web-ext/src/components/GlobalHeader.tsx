import { Icon } from "@iconify/react";
import { Header, _ } from "@originator-profile/ui";
import { useNavigate, useParams } from "react-router";
import { useSWRConfig } from "swr";
import { twMerge } from "tailwind-merge";
import { buildDetailUrl, routes } from "../utils/routes";
import { matchTabCacheKey } from "./activeTab/match-tab-cache-key";
import { Menu, MenuButton, MenuItem, useMenuButton } from "./Menu";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

function GlobalHeader({ className, children }: Props) {
  const { tabId } = useParams<{ tabId: string }>();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
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

  const handleReload = () => {
    if (!tabId) return;
    const numericTabId = Number(tabId);
    const base = routes.base.build({ tabId });
    void mutate(matchTabCacheKey(numericTabId), undefined);
    void navigate(base, { replace: true });
  };

  return (
    <Header className={twMerge("border-gray-200", className)}>
      {children}
      <div className="ml-auto flex items-center relative">
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded"
          onClick={handleReload}
          title={_("GlobalHeader_Reload")}
          aria-label={_("GlobalHeader_Reload")}
        >
          <Icon icon="mdi:refresh" className="w-5 h-5 text-gray-700" />
        </button>
        <MenuButton
          data-testid="global-header-menu-button"
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
              testId="detail-info-menu-item"
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
