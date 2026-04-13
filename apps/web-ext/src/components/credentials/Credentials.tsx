import {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
} from "@originator-profile/model";
import {
  AdvertisementTable,
  ArticleTable,
  Description,
  Image,
  _,
} from "@originator-profile/ui";
import placeholderLogoMainUrl from "@originator-profile/ui/src/assets/placeholder-logo-main.png";
import flush from "just-flush";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { buildPublUrl } from "../../utils/routes";
import CaFilter from "../CaFilter";
import CaSelector from "../CaSelector";
import ReliabilityGuide from "../ReliabilityGuide";
import WebMediaProfileSummaryCard from "../WebMediaProfileSummaryCard";
import { overlayExtensionMessenger } from "../overlay/extension-events";
import { BidResponse } from "../rtb";
import { listCas } from "./cas";
import { getContentType } from "./get-content-type";
import { isArticleLike } from "./is-articlelike";
import { CredentialsProps, SupportedVerifiedCa } from "./types";

export function Credentials(props: CredentialsProps) {
  const [caListType, setCaListType] =
    useState<Parameters<typeof listCas>[1]>("All");
  const { tabId } = useParams<{ tabId: string }>();

  const navigate = useNavigate();

  const filteredCas = listCas(props.cas, caListType);

  function onFilterUpdate(newFilterType: Parameters<typeof listCas>[1]) {
    setCaListType(newFilterType);
    const newlyFilteredCas = listCas(props.cas, newFilterType);
    const [ca] = newlyFilteredCas;

    // フィルター結果が空でもオーバーレイを更新する
    void overlayExtensionMessenger.sendMessage(
      "enter",
      {
        framesCas: props.framesCas,
        activeCa: ca ?? null,
        wmps: flush(
          props.ops.flatMap((op) => op.media?.map((m) => m.doc) ?? []),
        ),
        filterType: newFilterType,
      },
      Number(tabId),
    );

    if (ca) {
      void navigate(buildPublUrl(tabId, ca.attestation.doc));
    }
  }

  const handleClickCa = async (ca: SupportedVerifiedCa) => {
    void overlayExtensionMessenger.sendMessage(
      "enter",
      {
        framesCas: props.framesCas,
        activeCa: ca,
        wmps: flush(
          props.ops.flatMap((op) => op.media?.map((m) => m.doc) ?? []),
        ),
        filterType: caListType,
      },
      Number(tabId),
    );
  };

  const contentType = getContentType(props.ca);
  const ca = props.ca.attestation.doc;

  const renderWebMediaProfileSummaryCard = () => {
    return props.orgPath && props.wmp ? (
      <div className="mb-3" data-testid="ps-json-holder">
        <WebMediaProfileSummaryCard to={props.orgPath} wmp={props.wmp} />
      </div>
    ) : (
      <div>
        <h1
          className="text-base text-center mb-6"
          data-testid="web-media-profile-missing"
        >
          {_("WebMediaProfile_Missing")}
        </h1>
        <p className="whitespace-pre-line text-xs text-gray-700 text-center leading-5">
          {_("WebMediaProfile_Missing_Reason")}
        </p>
      </div>
    );
  };

  return (
    <div data-testid="cas" className="flex">
      <div className="flex flex-col border-r border-gray-200">
        <CaFilter
          caListType={caListType}
          setCaListType={onFilterUpdate}
          cas={props.cas}
        />
        <nav className="shrink-0 w-16 overflow-y-auto bg-white sticky top-0 z-10 border-t border-gray-200">
          <CaSelector filteredCas={filteredCas} onClickCa={handleClickCa} />
        </nav>
      </div>
      <main className="flex-1">
        <div className="bg-gray-100 min-h-screen p-4">
          <div className="pt-4">
            <ReliabilityGuide className="mb-3" contentType={contentType} />
            {renderWebMediaProfileSummaryCard()}
            <hr className="mb-3" />
            <div className="flex flex-row gap-3 mb-2">
              <Image
                className="shrink-0 bg-white rounded-md"
                src={ca.credentialSubject.image?.id}
                placeholderSrc={placeholderLogoMainUrl}
                alt=""
                width={120}
                height={80}
              />
              <div>
                <p className="text-sm text-gray-900 font-bold">
                  {isArticleLike(ca.credentialSubject)
                    ? ca.credentialSubject.headline
                    : (ca.credentialSubject.name ??
                      _("Credentials_UntitledContent"))}
                </p>
              </div>
            </div>
            {isArticleLike(ca.credentialSubject) && (
              <ArticleTable
                className="mb-1 w-full"
                article={ca as ArticleCA | AdvertorialCA}
              />
            )}
            {ca.credentialSubject.type === "OnlineAd" && (
              <>
                <AdvertisementTable
                  className="mb-1 w-full"
                  advertisement={ca as AdvertisementCA}
                />
                <BidResponse
                  className="w-full py-1"
                  tabId={Number(tabId)}
                  advertisement={ca as AdvertisementCA}
                />
              </>
            )}
            {ca.credentialSubject.description && (
              <Description description={ca.credentialSubject.description} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
