import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { Editor } from "@monaco-editor/react";
import { CssBaseline, DialogContent, GlobalStyles, Stack, ThemeProvider } from "@mui/material";
import {
  CSSProperties,
  PropsWithChildren,
  useLayoutEffect,
  useMemo,
  useState
} from "react";
import { createPortal } from "react-dom";
import { theme } from "../../../utils/mui/theme";
import { DEFAULT_1V1_TIMER_STYLES, Render1v1Overlay } from "../../mode_1v1/mode_1v1-app";
// import { theme } from "./theme"; // dein Theme

type IFrameProps = PropsWithChildren<{ style?: CSSProperties; className?: string }>;

/**
 * Rendert Kinder in ein iframe und sorgt dafür, dass Emotion/MUI
 * Styles im iframe-Head landen.
 */
function IFrame({ children, style, className }: IFrameProps) {
  const [node, setNode] = useState<HTMLIFrameElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  // Initialisiere das iframe-Dokument (same-origin) mit Grundgerüst
  useLayoutEffect(() => {
    if (!node) return;
    const d = node.contentDocument;
    if (!d) return;

    // Falls das iframe noch leer ist, schreibe ein minimalistisches Dokument
    if (d.readyState === "loading" || !d.body.firstChild) {
      d.open();
      d.write(`<!doctype html><html><head><meta charset="utf-8"><base target="_parent"></base></head><body></body></html>`);
      d.close();
    }
    setDoc(d);
  }, [node]);

  // Emotion-Cache, der in den iframe-Head schreibt
  const cache = useMemo(
    () =>
      doc
        ? createCache({
          key: "mui-in-iframe",
          prepend: true,
          container: doc.head,
        })
        : null,
    [doc]
  );

  return (
    <iframe ref={setNode} style={style} className={className}>
      {doc && cache &&
        createPortal(<CacheProvider value={cache}>{children}</CacheProvider>, doc.body)}
    </iframe>
  );
}


export const AppSettings1v1ThemeEditor = () => {
  const [css, setCss] = useState(DEFAULT_1V1_TIMER_STYLES);

  return (
    <DialogContent
      sx={{
        p: 0,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        pt: "var(--winbar-h)",
      }}
    >
      <Stack spacing={1} maxHeight="100vh" p={4} overflow="hidden">
        <Stack height={170} width={700} alignItems="center" justifyContent="center">
          <IFrame style={{ width: "100%", height: "100%" }}>
            <ThemeProvider theme={theme}>
              <GlobalStyles styles="body{background:transparent !important;}" />
              <CssBaseline />
              {/* Falls MUI-Komponenten im iframe selbst wieder Portals nutzen (z.B. Menu),
                  setze deren container/disablePortal passend auf doc.body */}
              <Render1v1Overlay onApi={() => { }} customCss={css} />
            </ThemeProvider>
          </IFrame>
        </Stack>

        <Editor
          height="100%"
          onChange={(newCss) => setCss(newCss)}
          language="css"
          defaultValue={css}
        />
      </Stack>
    </DialogContent>
  );
};