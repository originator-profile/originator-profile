import { Image } from "@originator-profile/ui";
import placeholderDpThumbnail from "@originator-profile/ui/src/assets/placeholder-dp-thumbnail.png";
import clsx from "clsx";
import { Link, useParams } from "react-router";
import { buildPublUrl } from "../utils/routes";
import { SupportedVerifiedCa, SupportedVerifiedCas } from "./credentials";

type Props = {
  filteredCas: SupportedVerifiedCas;
  onClickCa?: (ca: SupportedVerifiedCa) => void;
};

function CaSelector({ filteredCas, onClickCa }: Props) {
  const { issuer, subject, ...params } = useParams<{
    issuer: string;
    subject: string;
    tabId: string;
  }>();
  const tabId = Number(params.tabId);

  return (
    <ul>
      {filteredCas.map((ca) => {
        const active =
          ca.attestation.doc.issuer === issuer &&
          ca.attestation.doc.credentialSubject.id === subject;
        return (
          <li
            key={`${ca.attestation.doc.issuer}${ca.attestation.doc.credentialSubject.id}`}
          >
            <Link
              className="flex justify-center items-center h-16 relative"
              to={buildPublUrl(tabId, ca.attestation.doc)}
              onClick={() => onClickCa?.(ca)}
            >
              <div className="inline-block">
                <Image
                  className={clsx(
                    "bg-gray-200 rounded-lg transition duration-300 ease-in-out hover:ring-2 hover:ring-gray-500 hover:ring-offset-2",
                    { ["ring-2 ring-gray-500 ring-offset-2"]: active },
                  )}
                  src={ca.attestation.doc.credentialSubject.image?.id}
                  placeholderSrc={placeholderDpThumbnail}
                  alt={(() => {
                    const subject = ca.attestation.doc.credentialSubject;
                    if (
                      subject.type === "Article" ||
                      subject.type === "Advertorial"
                    ) {
                      return subject.headline;
                    }
                    if (subject.type === "OnlineAd") {
                      return subject.name;
                    }
                    return "";
                  })()}
                  width={44}
                  height={44}
                  cover
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default CaSelector;
