import { _ } from "@originator-profile/extension-common/ui";
import { useParams } from "react-router";
import useSWR from "swr";
import Loading from "../components/Loading";
import { loadDetail } from "../detail/snapshot";
import Template from "../templates/Detail";

function Detail() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading } = useSWR(["organization-detail", id], () =>
    loadDetail(id),
  );
  if (isLoading) return <Loading />;
  if (!data) {
    return (
      <main className="p-6">
        <p className="text-sm text-black">{_("Detail_NotFound")}</p>
      </main>
    );
  }
  return <Template detail={data} />;
}

export default Detail;
