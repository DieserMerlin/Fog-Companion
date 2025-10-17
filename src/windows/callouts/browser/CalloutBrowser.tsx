import useIsFocusVisible from '@mui/utils/useIsFocusVisible';
import { GameStateGuesser, GameStateMap, MapResolver } from "../../../game_state/GameState";
import { Accordion } from "../../../utils/mui/Accordion";
import { useMapDir } from "./use-callout-map-dir";
import { useMapBrowserNavigation } from "./use-map-browser-navigation";


import { ArrowBack, ArrowDownward, ArrowForward, ArrowForwardIos, ArrowUpward, KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight, KeyboardArrowUp } from '@mui/icons-material';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import { ButtonBaseActions } from '@mui/material/ButtonBase/ButtonBase';
import Stack from '@mui/material/Stack';
import { CALLOUT_SETTINGS } from '../callout-settings';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';


const normalizeFileName = (fileName: string) => fileName.replace(/_/g, '').replace(/\.[a-z]+$/gi, '');

export const CalloutMapBrowser = (props: { current: GameStateMap | null, onSelect: (map: GameStateMap | null) => void }) => {
  const { realms } = useMapDir();

  const isEqualMap = (map1: { mapFile: string, realm: string }, map2: { mapFile: string; realm: string }) => {
    return map1?.mapFile === map2?.mapFile && map1?.realm === map2?.realm;
  };

  const selectMap = async (map: { realm: string, mapFile: string }) => {
    props.onSelect(isEqualMap(map, props.current) ? null : await MapResolver.makeMap({ ...map }));
    CALLOUT_SETTINGS.update({ browser: false });
  };

  const { realmOpen, selectedMapIndex, selectedRealmIndex } = useMapBrowserNavigation();
  console.log({ realmOpen, selectedRealmIndex, selectedMapIndex });

  const {
    isFocusVisibleRef,
    onFocus: onFVFocus,
    onBlur: onFVBlur,
    ref: focusVisibleRef,
  } = useIsFocusVisible();

  return (
    <Stack flexGrow={1} overflow={'auto'}>
      {realms.map(({ realm, mapFiles }, i) => {
        const selected = selectedRealmIndex === i;
        const open = selected && realmOpen;

        // Summary: programmatic focus + center on selection
        const setSummaryRef = selected
          ? (el: HTMLDivElement | null) => {
            focusVisibleRef(el);
            if (!el) return;
            isFocusVisibleRef.current = true;
            el.focus();
            // ⬇️ center the selected summary in the scroll container
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          }
          : () => void 0;

        return (
          <Accordion /* name={realm} */ variant="outlined" expanded={open}>
            <AccordionSummary
              expandIcon={selected ? <Key><ArrowForward /></Key> : undefined}
              slotProps={{ root: { ref: setSummaryRef, onFocus: onFVFocus, onBlur: onFVBlur } }}
              className={selected ? 'Mui-focusVisible' : undefined}
            >
              {realm}
            </AccordionSummary>

            <AccordionDetails>
              <Stack spacing={1}>
                {mapFiles.map((mapFile, j) => {
                  const selectedBtn = open && selectedMapIndex === j;

                  const setBtnAction = selectedBtn
                    ? (actions: ButtonBaseActions | null) => {
                      if (!actions) return;
                      actions.focusVisible();
                      // scroll the newly focused button into view
                      setTimeout(() => requestAnimationFrame(() => {
                        const el = document.activeElement as HTMLElement | null;
                        el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                      }), 150);
                    }
                    : undefined;

                  // ⬇️ only for the selected button, center it
                  const setBtnRef = selectedBtn
                    ? (el: HTMLButtonElement | null) => {
                      if (!el) return;
                      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                    }
                    : undefined;

                  const onOpen = () => selectMap({ realm, mapFile });
                  if (selectedBtn) useMapBrowserNavigation.getState().ref.onOpenCallback = onOpen;

                  return (
                    <Button
                      endIcon={selectedBtn ? <Key><ArrowForward /></Key> : undefined}
                      name={mapFile}
                      ref={setBtnRef}
                      action={setBtnAction}
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={onOpen}
                      color={isEqualMap({ realm, mapFile }, props.current) ? 'error' : 'info'}
                      focusRipple={false}
                      disableRipple
                      data-selected={selectedBtn ? 'true' : undefined}
                      sx={{
                        '&[data-selected="true"]': {
                          outline: (t) => `2px solid ${t.palette.primary.main}`,
                          outlineOffset: 2,
                          boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}33`,
                        },
                        '&.Mui-focusVisible:not([data-selected="true"])': {
                          outline: 'none',
                          boxShadow: 'none',
                        },
                      }}
                      tabIndex={selectedBtn ? 0 : -1}
                    >
                      {normalizeFileName(mapFile)}
                    </Button>
                  );
                })}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
};

const Key = (props: { children: any }) => {
  return (
    <Stack mx={.2} style={{ display: 'inline-block', borderRadius: 5, border: '1px solid white' }} alignItems={'center'} justifyContent={'center'} overflow={'hidden'} width={25} height={25} textAlign={'center'} textOverflow={'clip'} fontSize={'10px !important'} color={'white !important'}>
      <span>{props.children}</span>
    </Stack>
  );
}