import {
  AdvertisementCA,
  AdvertisementSubject,
  Page,
} from "@originator-profile/model";
import { twMerge } from "tailwind-merge";
import { _ } from "../utils";
import Table from "./Table";
import TableRow from "./TableRow";
import { ExternalLink } from "./link";

type Props = {
  className?: string;
  advertisement: AdvertisementCA;
};

function renderLinkRow(
  ca: AdvertisementSubject,
  key:
    | "adReportContact"
    | "adReviewGuidelines"
    | "targetingPolicy"
    | "adDataHandlingPolicy",
  header: string,
) {
  const value = ca[key];
  if (!value) return null;
  return (
    <TableRow
      header={header}
      data={<ExternalLink href={value.id}>{value.name}</ExternalLink>}
    />
  );
}

function renderAdDisplayRationale(rationale?: {
  page?: Page;
  description?: string;
}) {
  if (!rationale) return null;
  if (rationale.page) {
    return (
      <>
        <ExternalLink href={rationale.page.id}>
          {rationale.page.name}
        </ExternalLink>
        {rationale.description && <p>{rationale.description}</p>}
      </>
    );
  }
  return rationale.description ?? null;
}

function AdvertisementTable({ className, advertisement }: Props) {
  const ca = advertisement.credentialSubject;
  return (
    <Table
      className={twMerge(
        "[&_tbody]:divide-y [&_tr]:h-7 [&_th]:w-20",
        className,
      )}
    >
      {"genre" in ca && (
        <TableRow header={_("ArticleTable_Category")} data={ca.genre} />
      )}
      {"landingPageUrl" in ca && (
        <TableRow
          header={_("AdvertisementTable_LandingPage")}
          data={
            <ExternalLink href={ca.landingPageUrl}>
              {ca.landingPageUrl}
            </ExternalLink>
          }
        />
      )}
      {renderLinkRow(
        ca,
        "adReportContact",
        _("AdvertisementTable_AdReportContact"),
      )}
      {renderLinkRow(
        ca,
        "adReviewGuidelines",
        _("AdvertisementTable_AdReviewGuidelines"),
      )}
      {renderLinkRow(
        ca,
        "targetingPolicy",
        _("AdvertisementTable_TargetingPolicy"),
      )}
      {renderLinkRow(
        ca,
        "adDataHandlingPolicy",
        _("AdvertisementTable_AdDataHandlingPolicy"),
      )}
      {"adDisplayRationale" in ca && (
        <TableRow
          header={_("AdvertisementTable_AdDisplayRationale")}
          data={renderAdDisplayRationale(ca.adDisplayRationale)}
        />
      )}
    </Table>
  );
}

export default AdvertisementTable;
