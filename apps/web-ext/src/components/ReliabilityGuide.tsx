import { Icon } from "@iconify/react";
import { ModalDialog, _, useModalDialog } from "@originator-profile/ui";
import { twMerge } from "tailwind-merge";
import LinkVerification from "./LinkVerification";

type Props = {
  className?: string;
  contentType: string;
  showLinkVerification?: boolean;
};

export default function ReliabilityGuide(props: Props) {
  const dialog = useModalDialog();

  return (
    <div className={twMerge("text-center space-y-2", props.className)}>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex flex-row flex-wrap items-center justify-center gap-2">
          <p className="whitespace-pre-line text-base font-bold text-primary-800">
            {props.contentType === "ContentType_Site"
              ? _("ReliabilityGuide_SiteOperator")
              : _("ReliabilityGuide_Publisher", _(props.contentType))}
          </p>
          {props.showLinkVerification && <LinkVerification />}
        </div>
      </div>
      <button
        className="text-xs text-primary-700 px-3 py-2 inline-flex items-center gap-1 hover:bg-primary-100 rounded-full"
        onClick={dialog.open}
      >
        <Icon className="inline w-3 h-3 mr-1" icon="material-symbols:help" />
        {_("ReliabilityGuide_AboutReliabilityInformation")}
      </button>
      <ModalDialog
        dialogRef={dialog.ref}
        className="group-aria-hidden:translate-y-full translate-y-0 bottom-0 w-full"
        onClose={dialog.close}
      >
        {({ titleId, descriptionId }) => (
          <section className="jumpu-card p-5 rounded-2xl rounded-b-none space-y-3">
            <h2
              id={titleId}
              className="whitespace-pre-line text-base font-bold mb-1.5 text-start"
            >
              {_("ReliabilityGuide_VerifiedOrganizationStatementTitle")}
            </h2>
            <p
              id={descriptionId}
              className="whitespace-pre-line text-sm text-gray-600 text-start"
            >
              {_("ReliabilityGuide_VerifiedOrganizationStatement")}
            </p>
          </section>
        )}
      </ModalDialog>
    </div>
  );
}
