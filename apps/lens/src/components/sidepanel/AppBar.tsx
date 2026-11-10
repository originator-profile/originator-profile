import { _ } from "@originator-profile/extension-common/ui";

/** サイドパネルのアプリバー */
export function AppBar() {
  return (
    <header className="flex items-center gap-2 border-b border-gray-300 bg-white px-4 py-2">
      <img
        src={chrome.runtime.getURL("icons/48x48.png")}
        alt=""
        width={32}
        height={32}
      />
      <p className="text-xs leading-[1.24] font-bold text-black">
        {_("extensionName")}
      </p>
    </header>
  );
}
