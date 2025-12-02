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
      originator.core.doc.credentialSubject.id ===
      siteProfile.credential.doc.issuer,
  );
  const orgPath = op && {
    pathname: routes.org.build(
      routes.org.getParams({
        contentType: "ContentType_Site",
        cp: op.core.doc,
      }),
    ),
    search: queryParams.toString(),
  };

  return (
    <Template
      siteProfile={siteProfile}
      orgPath={orgPath}
      wmp={op?.media?.doc}
      wsp={siteProfile.credential.doc}
    />
  );
}
