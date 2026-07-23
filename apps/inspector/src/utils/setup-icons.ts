// Iconify API への問い合わせを避けるため、アプリ内で使用しているアイコンを
// あらかじめローカルデータとして登録する。
// 登録済みのアイコンは `<Icon icon="prefix:name" />` の文字列指定のまま
// ローカルデータから解決され、Iconify API へのリクエストは発生しない。
import { addIcon } from "@iconify/react";

import fa6SolidArrowRight from "@iconify-icons/fa6-solid/arrow-right";
import fa6SolidArrowUpRightFromSquare from "@iconify-icons/fa6-solid/arrow-up-right-from-square";
import fa6SolidCheck from "@iconify-icons/fa6-solid/check";
import fa6SolidChevronLeft from "@iconify-icons/fa6-solid/chevron-left";
import fa6SolidTriangleExclamation from "@iconify-icons/fa6-solid/triangle-exclamation";
import ggCheckO from "@iconify-icons/gg/check-o";
import icRoundCancel from "@iconify-icons/ic/round-cancel";
import icRoundCheck from "@iconify-icons/ic/round-check";
import icRoundWarning from "@iconify-icons/ic/round-warning";
import ionFilter from "@iconify-icons/ion/filter";
import materialSymbolsHelp from "@iconify-icons/material-symbols/help";
import mdiEllipsisVertical from "@iconify-icons/mdi/ellipsis-vertical";
import mdiRefresh from "@iconify-icons/mdi/refresh";
import solarAltArrowRightBold from "@iconify-icons/solar/alt-arrow-right-bold";

addIcon("fa6-solid:arrow-right", fa6SolidArrowRight);
addIcon("fa6-solid:arrow-up-right-from-square", fa6SolidArrowUpRightFromSquare);
addIcon("fa6-solid:check", fa6SolidCheck);
addIcon("fa6-solid:chevron-left", fa6SolidChevronLeft);
addIcon("fa6-solid:triangle-exclamation", fa6SolidTriangleExclamation);
addIcon("gg:check-o", ggCheckO);
addIcon("ic:round-cancel", icRoundCancel);
addIcon("ic:round-check", icRoundCheck);
addIcon("ic:round-warning", icRoundWarning);
addIcon("ion:filter", ionFilter);
addIcon("material-symbols:help", materialSymbolsHelp);
addIcon("mdi:ellipsis-vertical", mdiEllipsisVertical);
addIcon("mdi:refresh", mdiRefresh);
addIcon("solar:alt-arrow-right-bold", solarAltArrowRightBold);
