import { useSearchParams } from "react-router";
import { useCredentials } from "../components/credentials";
import { useSiteProfile } from "../components/siteProfile";
import Template from "../templates/DetailInfo";

type Props = { back: string };

function DetailInfo(props: Props) {
  const {
    siteProfile,
    error: sp_error,
    warnings: sp_warnings,
  } = useSiteProfile();
  const {
    ops,
    cas,
    framesCas,
    error: credentials_error,
    warnings: credentials_warnings,
  } = useCredentials();
  const [queryParams] = useSearchParams();
  const backPath = {
    pathname: props.back,
    search: queryParams.toString(),
  };
  return (
    <Template
      sp={siteProfile}
      ops={ops}
      cas={cas}
      framesCas={framesCas}
      errors={[sp_error, credentials_error].filter((x) => x !== undefined)}
      warnings={[...(sp_warnings ?? []), ...(credentials_warnings ?? [])]}
      backPath={backPath}
    />
  );
}

export default DetailInfo;
