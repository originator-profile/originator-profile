import { WebMediaProfile } from "@originator-profile/model";
import { _ } from "../utils";
import Table from "./Table";
import TableRow from "./TableRow";
import { ExternalLink } from "./link";

type Props = {
  className?: string;
  wmp: WebMediaProfile;
};

function WebMediaProfileTable({ className, wmp }: Props) {
  return (
    <Table className={className}>
      <TableRow
        header={_("WebMediaProfileTable_Holder")}
        data={wmp.credentialSubject.name}
      />
      {/* TODO: 実在性確認証明から住所を表示して
      <TableRow
        header={_("WebMediaProfileTable_Address")}
        data={_("WebMediaProfileTable_AddressData", [
          holder.postalCode,
          holder.addressRegion,
          holder.addressLocality,
          holder.streetAddress,
        ])}
      />
      */}
      <TableRow
        header={_("WebMediaProfileTable_URL")}
        data={
          <ExternalLink href={wmp.credentialSubject.url}>
            {wmp.credentialSubject.url}
          </ExternalLink>
        }
      />
      {"telephone" in wmp.credentialSubject && (
        <TableRow
          header={_("WebMediaProfileTable_PhoneNum")}
          data={
            <ExternalLink href={`tel:${wmp.credentialSubject.telephone}`}>
              {wmp.credentialSubject.telephone}
            </ExternalLink>
          }
        />
      )}
      {"email" in wmp.credentialSubject && (
        <TableRow
          header={_("WebMediaProfileTable_Email")}
          data={
            <ExternalLink href={`mailto:${wmp.credentialSubject.email}`}>
              {wmp.credentialSubject.email}
            </ExternalLink>
          }
        />
      )}
      {/* TODO: 実在性確認書証明から法人番号を表示して "corporateNumber" in holder && (
        <TableRow
          header={_("WebMediaProfileTable_CorpNum")}
          data={
            <ExternalLink
              href={`https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${holder.corporateNumber}`}
            >
              {holder.corporateNumber}
            </ExternalLink>
          }
        />
      ) */}
      {wmp.credentialSubject.contactPoint && (
        <TableRow
          header={_("WebMediaProfileTable_Contact")}
          data={
            <ExternalLink href={wmp.credentialSubject.contactPoint.id}>
              {wmp.credentialSubject.contactPoint.name}
            </ExternalLink>
          }
        />
      )}
      {wmp.credentialSubject.privacyPolicy && (
        <TableRow
          header={_("WebMediaProfileTable_PrivacyPolicy")}
          data={
            <ExternalLink href={wmp.credentialSubject.privacyPolicy.id}>
              {wmp.credentialSubject.privacyPolicy.name}
            </ExternalLink>
          }
        />
      )}
      {wmp.credentialSubject.informationTransmissionPolicy && (
        <TableRow
          header={_("WebMediaProfileTable_Principle")}
          data={
            <ExternalLink
              href={wmp.credentialSubject.informationTransmissionPolicy.id}
            >
              {wmp.credentialSubject.informationTransmissionPolicy.name}
            </ExternalLink>
          }
        />
      )}
      {wmp.credentialSubject.publishingPrinciple && (
        <TableRow
          header={_("WebMediaProfileTable_Principle")}
          data={
            <ExternalLink href={wmp.credentialSubject.publishingPrinciple.id}>
              {wmp.credentialSubject.publishingPrinciple.name}
            </ExternalLink>
          }
        />
      )}
    </Table>
  );
}

export default WebMediaProfileTable;
