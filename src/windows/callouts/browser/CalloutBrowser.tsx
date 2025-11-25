import useIsFocusVisible from '@mui/utils/useIsFocusVisible';
import { Accordion } from "../../../utils/mui/Accordion";
import { useMapDir } from "./use-callout-map-dir";
import { useMapBrowserNavigation } from "./use-map-browser-navigation";


import { ArrowBack, ArrowDownward, ArrowForward, ArrowUpward, Close } from '@mui/icons-material';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import { ButtonBaseActions } from '@mui/material/ButtonBase/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { lighten } from '@mui/material/styles';
import useTheme from '@mui/system/useTheme';
import { AnimatePresence, motion } from 'motion/react';
import { CSSProperties, ReactNode } from 'react';
import { GameStateMap, MapResolver } from '../../../map_resolver/MapResolver';
import { useHotkeys } from '../../../utils/hooks/hotkey-hook';
import { CALLOUT_SETTINGS } from '../callout-settings';


const normalizeFileName = (fileName: string) => fileName.replace(/_/g, '').replace(/\.[a-z]+$/gi, '');
const KeyIconStyle = { fontSize: '10px !important' };

const KeyAnimations = {
  initial: { scale: .7, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: .7, opacity: 0 },
}

const HkUp = (props: { primaryColor?: boolean }) => {
  const hk = useHotkeys(s => s.map_browser_up);
  return (
    <Key
      shadowLevel={1}
      style={{
        position: 'absolute',
        top: props.primaryColor ? -20 : -18,
        right: 20,
        zIndex: 9999,
      }}
      keyStyle={{
        height: 20,
      }}
      icon={<ArrowUpward sx={KeyIconStyle} />}
      primaryColor={props.primaryColor}>
      {hk}
    </Key>
  );
}

const HkDown = (props: { primaryColor?: boolean }) => {
  const hk = useHotkeys(s => s.map_browser_down);
  return (
    <Key
      shadowLevel={1}
      style={{
        position: 'absolute',
        bottom: props.primaryColor ? -23 : -19,
        right: 20,
        zIndex: 9999,
      }}
      keyStyle={{
        height: 20,
      }}
      icon={<ArrowDownward sx={KeyIconStyle} />}
      primaryColor={props.primaryColor}>
      {hk}
    </Key>
  );
}

export const CalloutMapBrowser = (props: { current: GameStateMap | null, onSelect: (map: GameStateMap | null) => void }) => {
  const { realms } = useMapDir();

  const isEqualMap = (map1: { mapFile: string, realm: string }, map2: { mapFile: string; realm: string }) => {
    return MapResolver.Instance().baseName(map1?.mapFile || '') === MapResolver.Instance().baseName(map2?.mapFile || '');
  };

  const selectMap = (map: { realm: string, mapFile: string }) => {
    props.onSelect(isEqualMap(map, props.current) ? null : MapResolver.Instance().makeMap({ ...map }));
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

  console.log(realms);

  const hk = useHotkeys();

  return (
    <AnimatePresence mode='sync'>
      <Stack flexGrow={1} overflow={'auto'}>
        {Object.keys(realms).map((realm, i) => {
          const selected = selectedRealmIndex === i;
          const open = selected && realmOpen;
          const maps = Object.keys(realms[realm]);

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

          const isFirstRealm = i === 0;
          const isLastRealm = i === Object.keys(realms).length - 1;



          return (
            <Accordion /* name={realm} */ variant="outlined" expanded={open}>
              <AccordionSummary
                style={{ position: 'relative' }}
                expandIcon={selected ? (open ? <div style={{ transform: 'rotate(180deg)' }}><Key shadowLevel={3} icon={<ArrowBack sx={KeyIconStyle} />}>{hk.map_browser_left}</Key></div> : <Key shadowLevel={3} icon={<ArrowForward sx={KeyIconStyle} />}>{hk.map_browser_right}</Key>) : undefined}
                slotProps={{ root: { ref: setSummaryRef, onFocus: onFVFocus, onBlur: onFVBlur } }}
                className={selected ? 'Mui-focusVisible' : undefined}
              >
                {selected && !open && !isFirstRealm && (<HkUp />)}
                <span>{realm}</span>
                {selected && !open && !isLastRealm && (<HkDown />)}
              </AccordionSummary>

              <AccordionDetails>
                <Stack spacing={1}>
                  {maps.map((map, j) => {
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

                    const onOpen = () => selectMap({ realm, mapFile: map });
                    if (selectedBtn) useMapBrowserNavigation.getState().ref.onOpenCallback = onOpen;

                    const isFirstMap = j === 0;
                    const isLastMap = j === maps.length - 1;

                    return (
                      <Button
                        endIcon={selectedBtn ? <Key shadowLevel={3} icon={isEqualMap({ realm, mapFile: map }, props.current) ? <Close sx={KeyIconStyle} /> : <ArrowForward sx={KeyIconStyle} />}>{hk.map_browser_right}</Key> : undefined}
                        name={map}
                        ref={setBtnRef}
                        action={setBtnAction}
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={onOpen}
                        color={isEqualMap({ realm, mapFile: map }, props.current) ? 'error' : 'info'}
                        focusRipple={false}
                        disableRipple
                        data-selected={selectedBtn ? 'true' : undefined}
                        sx={{
                          position: 'relative',
                          textAlign: 'left !important',
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
                        {selectedBtn && !isFirstMap && (<HkUp primaryColor />)}
                        <Stack spacing={1} width={'100%'} direction={'row'} justifyContent={'center'}>
                          <Chip size='small' label={realms[realm][map] + 1} />
                          <span style={{ flexGrow: 1 }}>{normalizeFileName(map)}</span>
                        </Stack>
                        {selectedBtn && !isLastMap && (<HkDown primaryColor />)}
                      </Button>
                    );
                  })}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </AnimatePresence>
  );
};

const Key = (props: { children: ReactNode, style?: CSSProperties, keyStyle?: CSSProperties, icon: ReactNode, primaryColor?: boolean, shadowLevel: number }) => {
  const t = useTheme();
  return (
    <motion.div {...KeyAnimations} style={{
      ...(props.style || {}),
    }}>
      <Stack
        component="span"
        mx={0.2}
        // use sx for styling instead of style
        direction={'row'}
        spacing={.5}
        sx={t => ({
          bgcolor: lighten(t.palette.background.paper, .2),
          display: 'inline-flex',          // flex + inline so centering works
          borderRadius: 1,
          border: props.primaryColor ? '2px solid ' + t.palette.primary.main : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minWidth: 27,                    // minimum size, can grow wider
          height: 27,                      // fixed height
          pl: 0.5,
          pr: 1,                         // horizontal padding so longer text has space
          textAlign: 'center',
          fontSize: '11px !important',
          lineHeight: 1,
          color: 'white',
          textOverflow: 'clip',            // or 'ellipsis' if you prefer
          whiteSpace: 'nowrap',            // keep it on one line
          boxShadow: t.shadows[props.shadowLevel],
          ...(props.keyStyle || {}),
        })}
      >
        {props.icon}
        <span>{props.children}</span>
      </Stack>
    </motion.div>
  );
};