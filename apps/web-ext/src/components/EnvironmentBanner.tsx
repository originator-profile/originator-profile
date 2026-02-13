type Props = {
  mode: ImportMeta["env"]["MODE"];
};

function EnvironmentBanner({ mode }: Props) {
  if (mode === "production") {
    return null;
  }

  return (
    <div
      className="w-full bg-caution-extralight border-y border-caution-light p-2 text-center font-semibold text-sm"
      role="alert"
    >
      {`⚠️ ${mode.charAt(0).toUpperCase()}${mode.slice(1)} Build ⚠️`}
    </div>
  );
}

export default EnvironmentBanner;
