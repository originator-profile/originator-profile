import { useSearchParams } from "react-router";
import { useCredentials } from "../components/credentials";
import { useSiteProfile } from "../components/siteProfile";
import Template from "../templates/DetailInfo";

type Props = { back: string };

function DetailInfo(props: Props) {
  const { siteProfile, error: sp_error } = useSiteProfile();
  const { ops, framesCas, error: credentials_error } = useCredentials();
  const [queryParams] = useSearchParams();
  const backPath = {
    pathname: props.back,
    search: queryParams.toString(),
  };
  return (
    <Template
      sp={siteProfile}
      ops={ops}
      framesCas={framesCas}
      errors={[sp_error, credentials_error].filter((x) => x !== undefined)}
      backPath={backPath}
    />
  );
}

export default DetailInfo;
