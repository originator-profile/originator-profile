import { useCallback, useEffect, useId, useRef, useState } from "react";

interface UseMenuButtonOptions {
  onItemSelect?: (value: string) => void;
  items: string[];
}

export function useMenuButton({ onItemSelect, items }: UseMenuButtonOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const buttonId = useId();
  const menuId = useId();

  // Focus management
  const focusButton = useCallback(() => {
    buttonRef.current?.focus();
  }, []);

  const focusItem = useCallback(
    (index: number) => {
      if (index >= 0 && index < items.length) {
        setActiveIndex(index);
        setIsKeyboardNavigation(true);
      }
    },
    [items.length],
  );

  const focusFirstItem = useCallback(() => {
    focusItem(0);
  }, [focusItem]);

  const focusLastItem = useCallback(() => {
    focusItem(items.length - 1);
  }, [focusItem, items.length]);

  const focusNextItem = useCallback(() => {
    const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
    focusItem(nextIndex);
  }, [activeIndex, items.length, focusItem]);

  const focusPrevItem = useCallback(() => {
    const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
    focusItem(prevIndex);
  }, [activeIndex, items.length, focusItem]);

  // Menu control
  const openMenu = useCallback(() => {
    setIsOpen(true);
    setActiveIndex(0);
    setIsKeyboardNavigation(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
    setIsKeyboardNavigation(false);
    focusButton();
  }, [focusButton]);

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isOpen, closeMenu, openMenu]);

  // Item selection
  const selectItem = useCallback(
    (value: string) => {
      onItemSelect?.(value);
      closeMenu();
    },
    [onItemSelect, closeMenu],
  );

  // Button keyboard handlers
  const handleButtonKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
          break;
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            openMenu();
          } else {
            focusFirstItem();
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) {
            openMenu();
            requestAnimationFrame(() => focusLastItem());
          } else {
            focusLastItem();
          }
          break;
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            closeMenu();
          }
          break;
      }
    },
    [isOpen, closeMenu, openMenu, focusFirstItem, focusLastItem],
  );

  // Menu keyboard handlers
  const handleMenuKeyDown = useCallback(
    (event: React.KeyboardEvent, itemValue: string) => {
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          selectItem(itemValue);
          break;
        case "ArrowDown":
          event.preventDefault();
          focusNextItem();
          break;
        case "ArrowUp":
          event.preventDefault();
          focusPrevItem();
          break;
        case "Home":
          event.preventDefault();
          focusFirstItem();
          break;
        case "End":
          event.preventDefault();
          focusLastItem();
          break;
        case "Escape":
          event.preventDefault();
          closeMenu();
          break;
        case "Tab":
          // Let Tab work naturally to move focus out of menu
          closeMenu();
          break;
      }
    },
    [
      selectItem,
      focusNextItem,
      focusPrevItem,
      focusFirstItem,
      focusLastItem,
      closeMenu,
    ],
  );

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  // Set item ref
  const setItemRef = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  // Handle mouse enter for items
  const handleItemMouseEnter = useCallback((index: number) => {
    setActiveIndex(index);
    setIsKeyboardNavigation(false); // Mark as mouse navigation
  }, []);

  return {
    // State
    isOpen,
    activeIndex,
    isKeyboardNavigation,

    // Refs
    buttonRef,
    menuRef,
    setItemRef,

    // IDs
    buttonId,
    menuId,

    // Handlers
    toggleMenu,
    selectItem,
    handleButtonKeyDown,
    handleMenuKeyDown,
    handleItemMouseEnter,

    // ARIA attributes
    buttonProps: {
      "aria-haspopup": "menu" as const,
      "aria-expanded": isOpen,
      "aria-controls": isOpen ? menuId : undefined,
      id: buttonId,
    },
    menuProps: {
      role: "menu" as const,
      "aria-labelledby": buttonId,
      id: menuId,
    },
  };
}
