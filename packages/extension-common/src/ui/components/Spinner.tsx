import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
};

function Spinner({ className }: Props) {
  return (
    <div className={twMerge("jumpu-spinner", className)}>
      <svg viewBox="25 25 50 50">
        <circle cx="50" cy="50" r="20"></circle>
      </svg>
    </div>
  );
}

export default Spinner;
