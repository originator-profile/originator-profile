import { Icon } from "@iconify/react";
import { _ } from "@originator-profile/ui";
import { useMemo } from "react";
import { twMerge } from "tailwind-merge";
import { Menu, MenuButton, MenuItem, useMenuButton } from "./Menu";
import { listCas } from "./credentials";
import type { SupportedVerifiedCas } from "./credentials/types";

type Props = {
  caListType: Parameters<typeof listCas>[1];
  setCaListType: (contentType: Parameters<typeof listCas>[1]) => void;
  cas: SupportedVerifiedCas;
};

type FilterOption = {
  value: Parameters<typeof listCas>[1];
  title: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "All", title: _("CaFilter_All") },
  { value: "Main", title: _("CaFilter_MainContent") },
  { value: "Article", title: _("CaFilter_Article") },
  { value: "Advertorial", title: _("CaFilter_Advertorial") },
  { value: "OnlineAd", title: _("CaFilter_Advertisements") },
];

function CaFilter({ caListType, setCaListType, cas }: Props) {
  // 1件以上存在するフィルターオプションのみ表示（Allは常に表示）
  const availableOptions = useMemo(
    () =>
      FILTER_OPTIONS.filter(
        ({ value }) => value === "All" || listCas(cas, value).length,
      ),
    [cas],
  );
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
    items: availableOptions.map((option) => option.value),
    onItemSelect: (value) => {
      // Type guard to ensure value is valid
      const validOption = availableOptions.find(
        (option) => option.value === value,
      );
      if (validOption) {
        setCaListType(validOption.value);
      }
    },
  });

  return (
    <div className="relative">
      <MenuButton
        ref={buttonRef}
        className="flex w-16 h-10 items-center justify-center text-2xl"
        onClick={toggleMenu}
        onKeyDown={handleButtonKeyDown}
        {...buttonProps}
      >
        <Icon icon="ion:filter" />
      </MenuButton>

      <Menu
        ref={menuRef}
        isOpen={isOpen}
        hasKeyboardFocus={isKeyboardNavigation && activeIndex !== -1}
        className="rounded-lg absolute ml-2 py-2 w-36 bg-white shadow-lg z-20"
        {...menuProps}
      >
        {availableOptions.map((option, index) => {
          const isSelected = caListType === option.value;
          const isActive = activeIndex === index;
          return (
            <MenuItem
              key={option.value}
              ref={setItemRef(index)}
              value={option.value}
              selected={isSelected}
              active={isActive}
              onClick={() => setCaListType(option.value)}
              onKeyDown={(e) => handleMenuKeyDown(e, option.value)}
              onMouseEnter={() => handleItemMouseEnter(index)}
              className={twMerge("h-8 text-xs", isSelected && "cursor-default")}
            >
              <div className="flex items-center w-full">
                {isSelected && (
                  <Icon className="mx-2 absolute" icon="fa6-solid:check" />
                )}
                <p className="ml-8">{option.title}</p>
              </div>
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}

export default CaFilter;
