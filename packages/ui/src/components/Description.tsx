import type { WebMediaProfile } from "@originator-profile/model";
import { twMerge } from "tailwind-merge";
import { _ } from "../utils/get-message";
import useSanitizedHtmlForDescription from "../utils/use-sanitized-html-for-description";

type Props = {
  className?: string;
  description: WebMediaProfile["credentialSubject"]["description"];
  onlyBody?: boolean;
};

function Description({ className, description, onlyBody = false }: Props) {
  const html = useSanitizedHtmlForDescription(description);

  const body = (
    <div
      className={twMerge(
        "prose prose-xs text-xs break-words",
        onlyBody && className,
      )}
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
