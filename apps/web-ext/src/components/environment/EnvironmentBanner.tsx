import { formatBuildMode } from "./build-mode";

type Props = {
  mode: ImportMeta["env"]["MODE"];
};

export function EnvironmentBanner({ mode }: Props) {
  const message = formatBuildMode(mode);
  if (!message) return null;

  return (
    <div
      className="w-full bg-caution-extralight border-y border-caution-light p-2 text-center font-semibold text-sm"
      role="alert"
    >
      {message}
    </div>
  );
}
