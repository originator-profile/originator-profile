import { _ } from "@originator-profile/ui";

export function getProfileErrorMessage(error: Error) {
  return (
    _(
      error.message,
      typeof error.cause === "object" &&
        error.cause !== null &&
        "message" in error.cause
        ? _(
            String(error.cause.message),
            "cause" in error.cause &&
              typeof error.cause.cause === "object" &&
              error.cause.cause !== null &&
              "message" in error.cause.cause
              ? String(error.cause.cause.message)
              : undefined,
          ) || String(error.cause.message)
        : undefined,
    ) || error.message
  );
}
