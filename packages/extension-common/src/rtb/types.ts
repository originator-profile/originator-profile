/** OP ID */
type OpId = string;

/** 広告主 */
export type Advertiser = {
  type: "advertiser";
  id?: OpId;
};

/** 広告取引記載情報 */
export type BidResponse = {
  "@context"?: string;
  bidresponse?: {
    bid?: {
      op?: Array<Advertiser>;
    };
  };
};
