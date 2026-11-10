import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import bubbleTailUrl from "../../assets/bubble-tail.svg";
import type { AnnotationGroup, AnnotationView } from "../../view";
import { ExternalLink } from "./ExternalLink";

function Annotation({ annotation }: { annotation: AnnotationView }) {
  const { name, description, image, policyUrl } = annotation;
  return (
    <li className="jumpu-balloon relative flex flex-col gap-2 rounded-lg p-4 drop-shadow-[0_0_0.5px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-3.5">
        {image && (
          <Image
            className="shrink-0 bg-white"
            src={image}
            placeholderSrc={placeholderLogoMainUrl}
            alt=""
            width={60}
            height={40}
          />
        )}
        <h3 className="text-sm font-medium text-black">{name}</h3>
      </div>
      {description && (
        <p className="text-xs leading-normal text-black">{description}</p>
      )}
      {policyUrl && (
        <ExternalLink href={policyUrl}>
          {_("Detail_IssuancePolicy")}
        </ExternalLink>
      )}
      <img
        className="absolute right-[33px] -bottom-[7px] -rotate-45"
        src={bubbleTailUrl}
        alt=""
        width={14}
        height={14}
      />
    </li>
  );
}

/** PA 発行者と、その発行者による確認 */
export function AnnotationGroupView({ group }: { group: AnnotationGroup }) {
  const { issuer, annotations } = group;
  return (
    <section className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {annotations.map((annotation, index) => (
          <Annotation key={index} annotation={annotation} />
        ))}
      </ul>
      <div className="jumpu-card flex items-center gap-3 rounded-xl p-4">
        {issuer.logo && (
          <Image
            className="shrink-0"
            src={issuer.logo}
            placeholderSrc={placeholderLogoMainUrl}
            alt=""
            width={40}
            height={40}
          />
        )}
        <p className="text-base leading-[1.3] font-medium text-black">
          {/* NOTE: 確認と発行者の対応は吹き出しの尾でしか見えないため、文言でも示す */}
          <span className="sr-only">{_("Detail_VerifiedBy")}</span>
          {issuer.name ?? issuer.id}
        </p>
      </div>
    </section>
  );
}
