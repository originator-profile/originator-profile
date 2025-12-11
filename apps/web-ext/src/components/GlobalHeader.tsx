import { useState } from "react";
import { Link, useParams } from "react-router";
import { Header, _ } from "@originator-profile/ui";
import { buildDetailUrl } from "../utils/routes";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

function GlobalHeader({ className, children }: Props) {
  const { tabId } = useParams<{ tabId: string }>();
  const [open, setOpen] = useState(false);

  return (
    <Header className={className}>
      {children}
      <div className="ml-auto relative">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="p-2 hover:bg-gray-100 rounded"
          aria-label="menu"
        >
          ⋮
        </button>

        {open && (
          <div className="absolute right-0 mt-2 bg-white border rounded shadow min-w-40">
            <Link
              to={buildDetailUrl(tabId ?? "")}
              className="block px-4 py-2 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              {_("DetailInfo")}
            </Link>
          </div>
        )}
      </div>
    </Header>
  );
}

export default GlobalHeader;
