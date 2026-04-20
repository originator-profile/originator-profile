import { AdvertisementCA } from "@originator-profile/model";
import useSWR from "swr";
import { twMerge } from "tailwind-merge";
import { messages } from "./messages";
import { findAdvertiser } from "./scripting";

type BidResponseProps = {
  className?: string;
  tabId: number;
  advertisement: AdvertisementCA;
};

/** 広告取引記載情報検証結果 */
export function BidResponse(props: BidResponseProps) {
  const res = useSWR(
    {
      key: "bidresponse",
      tabId: props.tabId,
      frameIds: [], // TODO: 新モデルに対応して
    },
    findAdvertiser,
  );

  const message =
    messages[
      res.data === undefined
        ? "loading"
        : res.data.id === undefined
          ? "missing"
          : res.data.id === props.advertisement.issuer
            ? "match"
            : "mismatch"
    ];
  const textColor = {
    default: "text-gray-600",
    success: "",
    danger: "text-danger",
  }[message.color];

  return (
    <section className={props.className}>
      <h2 className="mb-1 text-gray-500">{messages.rtb}</h2>
      <p className={twMerge("text-xs", textColor)}>{message.text}</p>
    </section>
  );
}
