import { _, Header } from "@originator-profile/ui";
import { Link } from "react-router";
import IconFa6SolidChevronLeft from "~icons/fa6-solid/chevron-left";

type Props = Parameters<typeof Link>[0];

function BackHeader({ className, children, ...props }: Props) {
  return (
    <Header className={className}>
      <Link
        {...props}
        className="jumpu-icon-button shrink-0 group"
        aria-describedby="tooltip-back"
      >
        <IconFa6SolidChevronLeft className="text-lg text-gray-700" />
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
