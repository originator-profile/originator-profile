import { twMerge } from "tailwind-merge";
import { _ } from "../utils";

type Props = {
  className?: string;
  value: unknown;
};

/** @deprecated */
function TechInfo({ className, value }: Props) {
  return (
    <div className={twMerge("jumpu-card p-5 rounded-2xl text-sm", className)}>
      <p className="text-base font-bold mb-3">{_("TechInfo_TechInfo")}</p>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default TechInfo;
