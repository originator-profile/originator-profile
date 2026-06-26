import { selectByLocale } from "@originator-profile/core";
import { isDisplayableProfileAnnotation } from "@originator-profile/ui";
import { getAnnotationPolicy } from "@originator-profile/verify";
import { useMemo } from "react";
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
  const op = useMemo(
    () =>
      ops?.find((op) =>
        op.media?.some(
          (m) =>
            m.doc.issuer === orgIssuer &&
            m.doc.credentialSubject.id === orgSubject,
        ),
      ),
    [ops, orgIssuer, orgSubject],
  );
  const selectedWmp = useMemo(
    () => op?.media && selectByLocale(op.media.map((m) => m.doc)),
    [op],
  );
  const selectedWsp = useMemo(
    () =>
      siteProfile?.sites && selectByLocale(siteProfile.sites.map((s) => s.doc)),
    [siteProfile],
  );
  const selectedAnnotations = useMemo(() => {
    const annotations = op?.annotations ?? [];
    return selectByLocale(
      annotations.map((a) => a.doc).filter(isDisplayableProfileAnnotation),
      {
        group: (a) =>
          JSON.stringify([
            a.issuer,
            a.credentialSubject.id,
            getAnnotationPolicy(a).id,
          ]),
      },
    );
  }, [op]);

  if (isLoading) return <Loading />;
  if (!selectedWmp) return "Not found";

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
