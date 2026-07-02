import { useSearchParams } from "react-router";
import { useCredentials } from "../components/credentials";
import { useSiteProfile } from "../components/siteProfile";
import Template from "../templates/DetailInfo";

type Props = { back: string };

function DetailInfo(props: Props) {
  const {
    siteProfile,
    error: spError,
    warnings: spWarnings,
  } = useSiteProfile();
  const {
    ops,
    cas,
    framesCas,
    error: credentialsError,
    warnings: credentialsWarnings,
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
      errors={[spError, credentialsError].filter((x) => x !== undefined)}
      warnings={[...(spWarnings ?? []), ...(credentialsWarnings ?? [])]}
      backPath={backPath}
    />
  );
}

export default DetailInfo;
