import { selectByLocale } from "@originator-profile/core";
import { useSearchParams } from "react-router";
import GlobalHeader from "../components/GlobalHeader";
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
  // Credential での CaSelector 部分とスタッキングコンテキストで下に重なってしまうため z-11 に設定
  if (!siteProfile) return <GlobalHeader className="sticky top-0 z-11" />;

  // sitesから適切なWebsiteProfileを選択
  const selectedWsp = selectByLocale(siteProfile.sites.map((s) => s.doc));
  if (!selectedWsp) return <GlobalHeader className="sticky top-0 z-11" />;

  // 選択されたWebsiteProfileの発行者に対応するOriginatorを検索
  const op = siteProfile.originators.find((originator) =>
    originator.media?.some(
      (m) => m.doc.credentialSubject.id === selectedWsp.issuer,
    ),
  );

  const selectedWmp = op?.media && selectByLocale(op.media.map((m) => m.doc));

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
      wmp={selectedWmp}
      wsp={selectedWsp}
    />
  );
}
