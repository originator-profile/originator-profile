import { WebMediaProfile } from "@originator-profile/model";
import { useEffect, useState, useRef } from "react";
import { useMount } from "react-use";
import {
  FramesVerifiedCas,
  SupportedVerifiedCa,
} from "../components/credentials";
import {
  CasMap,
  ContentsArea,
  overlayWindowMessenger,
} from "../components/overlay";

function Panel(props: { children?: React.ReactNode }) {
  const handleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) e.stopPropagation();
  };
  return (
    <div role="presentation" onClick={handleClick}>
      {props.children}
    </div>
  );
}

function App() {
  const [framesCas, setFramesCas] = useState<FramesVerifiedCas>([]);
  const [activeCa, setActiveCa] = useState<SupportedVerifiedCa | null>(null);
  const [wmps, setWmps] = useState<WebMediaProfile[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  const handleClose = () => dialog.current?.close();
  const handleOpen = () => dialog.current?.show();
  const handleKeyDown = (e: React.KeyboardEvent) =>
    e.key === "Escape" && handleClose();

  function handleTransitionEnd() {
    if (dialog.current?.open) return;
    overlayWindowMessenger.sendMessage("leave", null, window.parent);
  }

  useMount(() => {
    overlayWindowMessenger.sendMessage(
      "enter",
      { framesCas, activeCa, wmps },
      window.parent,
    );
  });

  useEffect(() => {
    const cleanupEnter = overlayWindowMessenger.onMessage(
      "enter",
      ({ data }) => {
        setFramesCas(data.framesCas);
        setActiveCa(data.activeCa);
        setWmps(data.wmps);
        handleOpen();
      },
    );

    const cleanupLeave = overlayWindowMessenger.onMessage("leave", () => {
      handleClose();
    });

    return () => {
      cleanupEnter();
      cleanupLeave();
    };
  });

  async function handleClickCa(ca: SupportedVerifiedCa) {
    setActiveCa(ca);
    overlayWindowMessenger.sendMessage(
      "select",
      { activeCa: ca },
      window.parent,
    );
  }

  const pageCas =
    framesCas?.find((frameCas) => frameCas.parentFrameId === -1)?.cas ?? [];

  // NOTE: dialog ロールが非対話的要素とみなされる
  // see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/932
  /* eslint jsx-a11y/no-noninteractive-element-interactions: "off" */
  return (
    <dialog
      className="block w-screen h-screen bg-transparent transition-opacity duration-300 ease-in-out opacity-0 open:opacity-100 z-[calc(infinity)] overflow-hidden"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      onTransitionEnd={handleTransitionEnd}
      ref={dialog}
    >
      <ContentsArea
        className="absolute top-0 left-0"
        contents={pageCas.flatMap((ca) => ca.attestation.doc.target)}
      />
      <Panel>
        <CasMap
          framesCas={framesCas}
          activeCa={activeCa}
          onClickCa={handleClickCa}
          wmps={wmps}
        />
      </Panel>
    </dialog>
  );
}

export default App;
