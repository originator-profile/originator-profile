import { Icon } from "@iconify/react";
import { _ } from "@originator-profile/ui";
import clsx from "clsx";
import { Menu, MenuButton, MenuItem, useMenuButton } from "./Menu";
import { listCas } from "./credentials";

type Props = {
  caListType: Parameters<typeof listCas>[1];
  setCaListType: (contentType: Parameters<typeof listCas>[1]) => void;
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

function CaFilter({ caListType, setCaListType }: Props) {
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
    items: FILTER_OPTIONS.map((option) => option.value),
    onItemSelect: (value) => {
      // Type guard to ensure value is valid
      const validOption = FILTER_OPTIONS.find(
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
        {FILTER_OPTIONS.map((option, index) => {
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
              className={clsx("h-8 text-xs", {
                "cursor-default": isSelected,
              })}
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
