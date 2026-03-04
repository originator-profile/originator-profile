import { selectByLocale } from "@originator-profile/core";
import { useParams, useSearchParams } from "react-router";
import Loading from "../components/Loading";
import {
  Credentials as Template,
  getContentType,
  useCredentials,
} from "../components/credentials";
import { routes } from "../utils/routes";

export default function Credentials() {
  const [queryParams] = useSearchParams();
  const { issuer = "", subject = "" } = useParams<{
    issuer?: string;
    subject?: string;
  }>();
  const { ops, cas, framesCas, isLoading, error } = useCredentials();
  if (isLoading) return <Loading />;
  if (error) {
    console.error("Error loading credentials:", error);
    return null;
  }
  const ca = cas.find(
    (ca) =>
      ca.attestation.doc.issuer === issuer &&
      ca.attestation.doc.credentialSubject.id === subject,
  );
  if (!ca) {
    console.error(`CA not found for issuer: ${issuer}, subject: ${subject}`);
    return null;
  }
  const op = ops.find((op) =>
    op.media?.some(
      (m) => m.doc.credentialSubject.id === ca.attestation.doc.issuer,
    ),
  );
  const selectedWmp = selectByLocale(op?.media?.map((m) => m.doc) ?? []);

  const getOrgPath = () => {
    if (!op?.media || !selectedWmp) return undefined;

    return {
      pathname: routes.org.build(
        routes.org.getParams({
          contentType: getContentType(ca),
          cp: op.core.doc,
        }),
      ),
      search: queryParams.toString(),
    };
  };

  return (
    <Template
      ca={ca}
      cas={cas}
      ops={ops}
      orgPath={getOrgPath()}
      wmp={selectedWmp}
      framesCas={framesCas}
    />
  );
}
