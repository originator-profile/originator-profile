import { twMerge } from "tailwind-merge";
import logoUrl from "../assets/logo.svg";
import { _ } from "../utils";

type Props = {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
};

function ProjectSummary({ as: As = "section", className }: Props) {
  return (
    <As
      className={twMerge(
        "flex flex-col items-center gap-6 bg-gray-100 rounded-md p-8",
        className,
      )}
    >
      <a
        className="flex justify-center items-center gap-2"
        href="https://originator-profile.org/"
        target="_blank"
        rel="noreferrer noopener"
      >
        <img width={186} height={40} src={logoUrl} alt="Originator Profile" />
      </a>
      <p className="whitespace-pre-line text-gray-700">
        {_("ProjectSummary_Statement_1")}
      </p>
      <p className="whitespace-pre-line text-gray-700">
        {_("ProjectSummary_Statement_2")}
      </p>
      <p className="text-xs text-center underline">
        <a
          href="https://originator-profile.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          https://originator-profile.org/
        </a>
      </p>
    </As>
  );
}

export default ProjectSummary;
