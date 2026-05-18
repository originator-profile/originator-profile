import { selectByLocale } from "@originator-profile/core";
import { useParams, useSearchParams } from "react-router";
import Loading from "../components/Loading";
import { useCredentials } from "../components/credentials";
import { useSiteProfile } from "../components/siteProfile";
import Template from "../templates/Org";

type Props = { back: string };

function Org(props: Props) {
  const [queryParams] = useSearchParams();
  const { contentType, orgIssuer, orgSubject } = useParams<{
    contentType: string;
    orgIssuer: string;
    orgSubject: string;
  }>();
  const { siteProfile } = useSiteProfile();
  const { ops, isLoading } = useCredentials();
  if (isLoading) return <Loading />;
  const op = ops?.find((op) =>
    op.media?.some(
      (m) =>
        m.doc.issuer === orgIssuer && m.doc.credentialSubject.id === orgSubject,
    ),
  );
  if (!op?.media) return null;
  const selectedWmp = selectByLocale(op.media.map((m) => m.doc));
  if (!selectedWmp) return null;

  // sitesから適切なWebsiteProfileを選択
  const selectedWsp = siteProfile?.sites
    ? selectByLocale(siteProfile.sites.map((s) => s.doc))
    : undefined;

  // 同一の認証種別 (certificationSystem.id) ごとにユーザーロケールに合致する PA を選択
  const selectedAnnotations = selectByLocale(op.annotations ?? [], {
    group: (a) => a.doc.credentialSubject.certificationSystem.id,
    getLangSource: (a) => a.doc,
  });

  const backPath = {
    pathname: props.back,
    search: queryParams.toString(),
  };
  return (
    <Template
      backPath={backPath}
      contentType={contentType ?? "ContentType_Document"}
      certificates={selectedAnnotations}
      ops={ops}
      wsp={selectedWsp}
      wmp={selectedWmp}
    />
  );
}

export default Org;
