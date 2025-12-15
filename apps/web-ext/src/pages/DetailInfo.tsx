import Template from "../templates/DetailInfo";
import { useSiteProfile } from "../components/siteProfile";
import { useCredentials } from "../components/credentials";
import { useSearchParams } from "react-router";

type Props = { back: string };

function DetailInfo(props: Props) {
  const { error: sp_error } = useSiteProfile();
  const { error: credentials_error } = useCredentials();
  const [queryParams] = useSearchParams();
  const backPath = {
    pathname: props.back,
    search: queryParams.toString(),
  };
  return (
    <Template
      errors={[sp_error, credentials_error].filter((x) => x !== undefined)}
      backPath={backPath}
    />
  );
}

export default DetailInfo;
