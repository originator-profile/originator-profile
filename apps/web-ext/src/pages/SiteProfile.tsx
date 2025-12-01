import { useSearchParams } from "react-router";
import Loading from "../components/Loading";
import {
  SiteProfile as Template,
  useSiteProfile,
} from "../components/siteProfile";
import { routes } from "../utils/routes";

export default function SiteProfile() {
  const [queryParams] = useSearchParams();
  const { siteProfile, isLoading } = useSiteProfile();
  if (isLoading) return <Loading />;
  if (!siteProfile) return null;
  const op = siteProfile.originators.find(
    (originator) =>
      originator.media?.doc.credentialSubject.id ===
      siteProfile.credential.doc.issuer,
  );
  if (!op?.media) {
    return (
      <Template siteProfile={siteProfile} wsp={siteProfile.credential.doc} />
    );
  }
  return (
    <Template
      siteProfile={siteProfile}
      orgPath={{
        pathname: routes.org.build(
          routes.org.getParams({
            contentType: "ContentType_Site",
            cp: op.core.doc,
          }),
        ),
        search: queryParams.toString(),
      }}
      wmp={op.media.doc}
      wsp={siteProfile.credential.doc}
    />
  );
}
