import { Icon } from "@iconify/react";
import { _, Header } from "@originator-profile/ui";
import { Link } from "react-router";

type Props = Parameters<typeof Link>[0];

function BackHeader({ className, children, ...props }: Props) {
  return (
    <Header className={className}>
      <Link
        {...props}
        className="jumpu-icon-button shrink-0 group"
        aria-describedby="tooltip-back"
      >
        <Icon className="text-lg text-gray-700" icon="fa6-solid:chevron-left" />
        <span
          id="tooltip-back"
          role="tooltip"
          className="[transform:translate(-50%,150%)_scale(0)]! group-hover:[transform:translate(-50%,150%)_scale(1)]!"
        >
          {_("BackHeader_Back")}
        </span>
      </Link>
      {children}
    </Header>
  );
}

export default BackHeader;
