import { twMerge } from "tailwind-merge";
import logoUrl from "../assets/logo.svg";
import { _ } from "../utils";

type Props = {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
};

function ProjectTitle({ as: As = "section", className }: Props) {
  return (
    <As
      className={twMerge("flex items-center flex-col gap-4 mb-12", className)}
    >
      <p className="whitespace-pre-line text-gray-700 text-xs">
        {_("ProjectTitle_TechSummary")}
      </p>
      <a
        className="flex justify-center items-center gap-2"
        href="https://originator-profile.org/"
        target="_blank"
        rel="noreferrer noopener"
      >
        <img width={186} height={40} src={logoUrl} alt="Originator Profile" />
      </a>
    </As>
  );
}

export default ProjectTitle;
