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
  const op = ops?.find(
    (op) =>
      op.media?.doc.issuer === orgIssuer &&
      op.media?.doc.credentialSubject.id === orgSubject,
  );
  if (!op?.media) return null;
  const backPath = {
    pathname: props.back,
    search: queryParams.toString(),
  };
  return (
    <Template
      backPath={backPath}
      contentType={contentType ?? "ContentType_Document"}
      certificates={op.annotations ?? []}
      ops={ops}
      wsp={siteProfile?.credential.doc}
      wmp={op.media.doc}
    />
  );
}

export default Org;
