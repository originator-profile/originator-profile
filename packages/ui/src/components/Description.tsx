import { twMerge } from "tailwind-merge";
import useSanitizedHtml from "../utils/use-sanitized-html";
import { _ } from "../utils/get-message";

type Props = {
  className?: string;
  description: string | object;
  onlyBody?: boolean;
};

function Description({ className, description, onlyBody = false }: Props) {
  const html = useSanitizedHtml(description);
  const body = (
    <div
      className="prose prose-xs text-xs break-words"
      dangerouslySetInnerHTML={{
        __html: html ?? "",
      }}
    />
  );
  if (onlyBody) return body;
  return (
    <section className={twMerge("py-1", className)}>
      <h2 className="mb-1 text-gray-600 font-normal">
        {_("Description_Description")}
      </h2>
      {body}
    </section>
  );
}

export default Description;
