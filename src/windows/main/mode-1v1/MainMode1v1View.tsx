import { AppPaginationWrapper, Killer, Mode1v1ChallengeNameSchema, Mode1v1TimerChallenge, useAppPagination } from "@diesermerlin/fog-companion-web";
import { ArrowForwardIos, Circle, Close, Delete, Edit, Gamepad, Lock, Save } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import Grow from "@mui/material/Grow";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { TimeView } from "@mui/x-date-pickers/models";
import { TimeClock } from "@mui/x-date-pickers/TimeClock";
import { useDebounce } from "@uidotdev/usehooks";
import { useLiveQuery } from "dexie-react-hooks";
import moment from "moment";
import { forwardRef, ReactNode, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AppDB } from "../../../utils/indexeddb/AppDB";
import { useSession } from "../../../utils/trpc/use-session";
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import { useCurrent1v1Challenge } from "../../mode_1v1/use-current-1v1-challenge";
import { useMode1v1State } from "../../mode_1v1/use-mode-1v1-state";
import { MainAppTab, useMainApp } from "../use-main-app";
import { Mode1v1ChallengeManager } from "./mode-1v1-manager";
import { MODE_1V1_SYNC } from "./mode-1v1-sync";
import CircularProgress from "@mui/material/CircularProgress";
import { ACCOUNT_SETTINGS } from "../account/account-settings";

const momentToMillis = (m: moment.Moment) => m.minutes() * 60_000 + m.seconds() * 1_000 + m.milliseconds();

const killerToNormalCase = (k: Killer) => {
  return k.split(/[\s_]/g).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const Points = (props: { challenge?: Mode1v1TimerChallenge, of: 'self' | 'opponent' }) => (props.challenge?.played || []).filter(g => !!g.kllrTime && !!g.survTime).filter(g => props.of === 'self' ? g.survTime < g.kllrTime : g.survTime > g.kllrTime).length;

export const MainMode1v1View = () => {
  const loggedIn = useSession(s => !!s.session?.user);
  const sync = ACCOUNT_SETTINGS.hook(s => s.sync1v1Challenges);

  return (
    <Stack spacing={.5} height={'100%'}>
      {!loggedIn && (
        <Alert variant="outlined" color="success">
          <Link onClick={() => useMainApp.setState({ tab: MainAppTab.ACCOUNT })}>Login</Link> to sync your chases and collect statistics!
        </Alert>
      )}
      {loggedIn && !sync && (
        <Alert variant="outlined" severity="warning">
          Syncing is disabled. Enable it in <Link onClick={() => useMainApp.setState({ tab: MainAppTab.ACCOUNT })}>your account</Link>.
        </Alert>
      )}
      <Typography variant="overline">Active Challenge</Typography>
      <CurrentGame />
      <Typography variant="overline">Previous Challenges</Typography>
      <PreviousGames />
    </Stack>
  );
}

const CurrentGame = () => {
  const manager = useMemo(() => Mode1v1ChallengeManager.Instance(), []);

  const current = useCurrent1v1Challenge();

  const currentGame = current?.played?.[(current?.played?.length || 1) - 1];
  const isRunning = useMode1v1State(s => !!s.state?.running);

  const isCommittable = !!current && !!currentGame && !isRunning && (!!currentGame.kllrTime || !!currentGame.survTime);
  const currentGameFinished = !currentGame || !!currentGame.kllrTime || !!currentGame.survTime;


  const addGame = (challenge: Mode1v1TimerChallenge) => {
    challenge.played.push({
      killer: null,
      survTime: 0,
      kllrTime: 0
    });
    manager.updateChallenge(challenge);
  }

  useEffect(() => {
    if (current && (currentGameFinished || !currentGame)) addGame(current);
  }, [current?.challengeId]);

  return (
    <Paper sx={{ p: 1 }} variant="outlined">
      <Stack direction={'row'} spacing={1} alignItems={'center'} justifyContent={'center'} fontFamily={'monospace'}>
        {!!current && <>
          <Stack spacing={1.2} pt={.2} px={.5} fontSize={18}>
            <b><Points challenge={current} of="self" /></b>
            <b><Points challenge={current} of="opponent" /></b>
          </Stack>
          <EditNames challenge={current} onChange={c => manager.updateChallenge(c)} disabled={isRunning} />
        </>}
        {!!currentGame && (
          <EditGamesMenu current challenge={current} onChange={c => manager.updateChallenge(c)} disabled={isRunning} />
        )}
        <span style={{ flexGrow: 1 }} />
        {!!current && <>
          <Stack height={'100%'} alignItems={'end'} justifyContent={'center'} style={{ opacity: .7 }} fontSize={12}>
            <small>Challenge {current.challengeId}</small>
            {current.startedAt === current.continuedAt && <span>Started at {new Date(current.startedAt).toLocaleString()}</span>}
            {current.startedAt !== current.continuedAt && <span>Continued at {new Date(current.continuedAt).toLocaleString()}</span>}
            <SyncIndicator challenge={current} />
          </Stack>
          <Stack spacing={.5}>
            <Button startIcon={<ArrowForwardIos />} onClick={() => addGame(current)} disabled={!currentGameFinished} color="primary" variant="contained" size="small" sx={{ height: '100%' }}>
              <Stack spacing={-.5}>
                <small><b>New game</b></small>
                <small>in current challenge</small>
              </Stack>
            </Button>
            <Button startIcon={<Save />} onClick={() => manager.createChallenge()} disabled={!isCommittable} color="warning" variant="outlined" size="small" sx={{ height: '100%' }}>
              <Stack spacing={-.5}>
                <small><b>Save challenge</b></small>
                <small>/ Create new</small>
              </Stack>
            </Button>
          </Stack>
        </>}
      </Stack>
    </Paper>
  );
}

const PreviousGames = () => {
  const manager = useMemo(() => Mode1v1ChallengeManager.Instance(), []);
  const { page, setPage, take, setTake, takeOptions } = useAppPagination();

  const total = useLiveQuery(() => AppDB.mode1v1Challenges.count(), [page]) - 1;
  const pages = Math.max(Math.ceil(total / take));
  const next = useLiveQuery(() => AppDB.mode1v1Challenges.orderBy('continuedAt').reverse().offset(1 + ((page - 1) * take)).limit(take).toArray(), [page, take]);

  const scrollTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => scrollTopRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), [page, take]);

  const [del, setDel] = useState<Mode1v1TimerChallenge | null>(null);
  const [editNames, setEditNames] = useState<Mode1v1TimerChallenge | null>(null);

  return (
    <>
      <DeleteDialog title={<>Delete this challenge?</>} open={!!del} onClose={() => setDel(null)} onConfirm={() => {
        manager.removeChallenge(del.challengeId);
        setDel(null);
      }} />
      <EditNamesDialog open={!!editNames} challenge={editNames} onChange={c => manager.updateChallenge(c)} onClose={() => setEditNames(null)} />
      <AppPaginationWrapper {...{ page, setPage, take, setTake, takeOptions, data: { page, pages, results: next, take, total }, isFetching: false, refetch: () => void 0, loadingText: '' }}>
        <Stack maxHeight={'100%'} overflow={'auto'} spacing={1} ref={scrollTopRef}>
          {next?.map(c => (
            <Paper sx={{ p: 1 }}>
              <Stack width={'100%'} spacing={1}>
                <Stack direction={'row'} width={'100%'} fontSize={10} spacing={.5}>
                  <span style={{ fontSize: 14 }}>{c.names.self || 'You'} <b><Points challenge={c} of="self" /></b> - <b><Points challenge={c} of="opponent" /></b> {c.names.opponent || 'Unnamed Opponent'} <small style={{ opacity: .6 }}><Link onClick={() => setEditNames(c)}><Edit sx={{ fontSize: 11 }} />Edit names</Link></small></span>
                  <span style={{ flexGrow: 1 }} />
                  <span style={{ opacity: .7 }}>Challenge {c.challengeId}</span>
                </Stack>
                <Stack direction={'row'} alignItems={'center'} spacing={1}>
                  <EditGamesMenu challenge={c} onChange={c => manager.updateChallenge(c)} />
                  <Grid container spacing={.5}>
                    {[...new Set(c.played.map(g => g.killer))].filter(k => !!k).map(k => (
                      <Grid>
                        <Chip
                          size='small'
                          variant="outlined"
                          label={killerToNormalCase(k as Killer) + ' Chase' + (c.played.filter(p => p.killer === k).length > 1 ? 's' : '')}
                          color="primary"
                          icon={<span style={{ fontFamily: 'monospace', fontSize: 12, padding: 4 }}>{c.played.filter(p => p.killer === k).length}</span>}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  <span style={{ flexGrow: 1 }} />
                  <Stack fontSize={12} textAlign={'right'}>
                    <span>Started at {new Date(c.startedAt).toLocaleString()}</span>
                    {c.continuedAt !== c.startedAt && <span>Continued at {new Date(c.continuedAt).toLocaleString()}</span>}
                    <SyncIndicator challenge={c} />
                  </Stack>
                  <IconButton color="error" onClick={() => setDel(c)}>
                    <Delete />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </AppPaginationWrapper>
    </>
  );
}

const SyncIndicator = (props: { challenge: Mode1v1TimerChallenge & { syncError?: boolean } }) => {
  const c = props.challenge;

  const syncing = MODE_1V1_SYNC.hook(s => s.syncing === c.challengeId);
  const syncError = c.syncError;

  const color = syncing ? 'info' : (syncError || !c.syncedAt) ? 'error' : (c.syncedAt < c.updatedAt) ? 'warning' : 'success';
  const text = syncing ? 'Syncing...' : syncError ? 'Sync error' : !c.syncedAt ? 'Not yet synced' : c.syncedAt < c.updatedAt ? 'Unsynced changes' : 'Synced at ' + new Date(c.syncedAt).toLocaleString();

  return (
    <Stack direction={'row'} spacing={.5} alignItems={'center'} justifyContent={'end'} width={'100%'}>
      <span>{text}</span>
      {syncing ? <CircularProgress size={12} color={color} /> : <Circle style={{ fontSize: 12 }} color={color} />}
    </Stack>
  )
}

type EditNamesRef = { isDebouncing: boolean };

const EditNames = forwardRef<EditNamesRef, { challenge: Mode1v1TimerChallenge, onChange: (c: Mode1v1TimerChallenge) => void, disabled?: boolean }>((props, ref) => {
  const [ownName, setOwnName] = useState(props.challenge.names.self || '');
  useEffect(() => setOwnName(props.challenge.names.self || ''), [props.challenge]);

  const [oppName, setOppName] = useState(props.challenge.names.opponent || '');
  useEffect(() => setOppName(props.challenge.names.opponent || ''), [props.challenge]);

  const debOwnName = useDebounce(ownName, 1500);
  const debOppName = useDebounce(oppName, 1500);

  const isDebouncing = ownName !== debOwnName || oppName !== debOppName;

  useImperativeHandle(ref, () => ({ isDebouncing }), [isDebouncing]);

  useEffect(() => {
    if (isDebouncing) return;
    props.challenge.names = { self: Mode1v1ChallengeNameSchema.parse(ownName), opponent: Mode1v1ChallengeNameSchema.parse(oppName) };
    props.onChange(props.challenge);
  }, [isDebouncing]);

  return (
    <Stack spacing={.5}>
      <TextField color={isDebouncing ? 'warning' : undefined} disabled={props.disabled} size="small" label={'Your name'} value={isDebouncing ? ownName : props.challenge.names.self || ''} onChange={e => setOwnName(e.target.value)} />
      <TextField color={isDebouncing ? 'warning' : undefined} disabled={props.disabled} size="small" label={'Opponent name'} value={isDebouncing ? oppName : props.challenge.names.opponent || ''} onChange={e => setOppName(e.target.value)} />
    </Stack>
  )
});

export const EditNamesDialog = (props: { open: boolean, onClose: () => void, challenge: Mode1v1TimerChallenge, onChange: (c: Mode1v1TimerChallenge) => void }) => {
  const [isDebouncing, setIsDebouncing] = useState(false);

  return (
    <Dialog open={props.open} onClose={() => !isDebouncing && props.onClose()} transitionDuration={0}>
      <DialogTitle>Edit names</DialogTitle>
      <DialogContent>
        <Stack py={1}>
          {!!props.challenge && <EditNames ref={ref => ref ? setIsDebouncing(ref.isDebouncing) : setIsDebouncing(false)} {...props} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isDebouncing} loading={isDebouncing} startIcon={<Close />} color="error" fullWidth onClick={() => !isDebouncing && props.onClose()}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const DeleteDialog = (props: { open: boolean, onClose: () => void, onConfirm: () => void, title: ReactNode }) => {
  return (
    <Dialog open={props.open} onClose={props.onClose} transitionDuration={0} maxWidth={"xs"} fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <p>This action is irreversible. <b>Chases will be deleted from your account too!</b></p>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button fullWidth variant="contained" startIcon={<Close />} color="error" onClick={props.onConfirm}>
          Delete
        </Button>
        <Button fullWidth startIcon={<Close />} onClick={props.onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

const EditGamesMenu = (props: { current?: boolean, challenge: Mode1v1TimerChallenge, onChange: (c: Mode1v1TimerChallenge) => void, disabled?: boolean }) => {
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [_editGame, setEditGame] = useState<number | null>(null);
  const [_delGame, setDelGame] = useState<number | null>(null);

  const editGame = _editGame !== null ? props.challenge.played[_editGame] : null;
  const delGame = _delGame !== null ? props.challenge.played[_delGame] : null;

  console.log({ editGame, delGame });

  useEffect(() => {
    if (!props.current) return;
    setMenuOpen(false);
    setEditGame(null);
    setDelGame(null);
  }, [props.disabled, props.challenge.challengeId]);

  return (
    <>
      <DeleteDialog title={<>Delete game #{props.challenge.played.indexOf(delGame) + 1}</>} open={!!delGame} onClose={() => setDelGame(null)} onConfirm={() => {
        setDelGame(null);
        props.challenge.played = props.challenge.played.filter(g => g !== delGame);
        props.onChange(props.challenge);
      }} />
      <Dialog open={!!editGame} onClose={() => setEditGame(null)} transitionDuration={0} maxWidth={'sm'} fullWidth slotProps={{ paper: { sx: { overflow: 'visible' } } }}>
        <DialogTitle>Edit game #{props.challenge.played.indexOf(editGame) + 1}</DialogTitle>
        <DialogContent>
          {!!editGame && (
            <Stack spacing={2} pb={1}>
              <p>
                You can edit the played killer as well as timer values. <b>Be careful tho.</b> This will influence your 1v1 statistics if upload is enabled.
              </p>
              <Stack spacing={1} width={'100%'} direction={'row'} alignItems={'center'} justifyContent={'center'}>
                <KillerSelector current={props.current} killer={editGame.killer as Killer || null} onChange={k => {
                  editGame.killer = k;
                  props.onChange(props.challenge);
                }} />
                <Stack direction={'row'} alignItems={'center'} spacing={.5}>
                  <CustomTimePicker
                    name="Survivor time"
                    value={moment(editGame.survTime)}
                    onChange={m => {
                      editGame.survTime = momentToMillis(m);
                      props.onChange(props.challenge);
                    }}
                    disabled={props.disabled} />
                  <CustomTimePicker
                    name="Killer time"
                    value={moment(editGame.kllrTime)}
                    onChange={m => {
                      editGame.kllrTime = momentToMillis(m);
                      props.onChange(props.challenge);
                    }}
                    disabled={props.disabled} />
                </Stack>
              </Stack>
            </Stack>
          )}
          <DialogActions>
            <Button fullWidth startIcon={<Close />} color="error" onClick={() => setEditGame(null)}>Close</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Button disabled={props.disabled} startIcon={<Gamepad />} color="info" variant="outlined" size="small" sx={{ height: props.current ? 86 : 45, width: 170 }} ref={editBtnRef} onClick={() => setMenuOpen(true)}>
        <Stack spacing={-.5}>
          <b>{props.current ? <>{(props.challenge.played.length || 1)}. Game</> : <>{props.challenge.played.length} Game{props.challenge.played.length > 1 ? 's' : ''}</>}</b>
          <small>Edit games/times</small>
        </Stack>
      </Button>
      <Menu
        anchorEl={editBtnRef.current}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        {props.challenge.played.map((g, i) => (
          [
            <MenuItem onClick={() => {
              setMenuOpen(false);
              setEditGame(props.challenge.played.indexOf(g));
            }}>
              <Stack spacing={1} width={'100%'}>
                <Stack direction={'row'} spacing={1} alignItems={'center'} width={'100%'}>
                  <span>Game #{props.challenge.played.indexOf(g) + 1}</span>
                  <span style={{ flexGrow: 1 }} />
                  {props.current && props.challenge.played.indexOf(g) === props.challenge.played.length - 1 && <Chip variant="outlined" size="small" color='success' sx={{ ml: 1 }} label='Current' />}
                  {props.challenge.played.length > 1 && (
                    <IconButton color="error" onClick={e => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setDelGame(props.challenge.played.indexOf(g));
                    }}>
                      <Delete />
                    </IconButton>
                  )}
                </Stack>
                <Stack direction={'row'} fontSize={11} width={'100%'} alignItems={'center'}>
                  <Stack spacing={-.3}>
                    <span>Killer</span>
                    <span>Survivor time</span>
                    <span>Killer time</span>
                  </Stack>
                  <Stack spacing={-.3} flexGrow={1} mx={1} textAlign={'center'}>
                    <span>-</span>
                    <span>-</span>
                    <span>-</span>
                  </Stack>
                  <Stack spacing={-.3} textAlign={'right'} fontWeight={'bold'}>
                    <span>{!!g.killer ? killerToNormalCase(g.killer as Killer) : 'None'}</span>
                    <span>{moment(g.survTime).format('mm:ss:SS')}</span>
                    <span>{moment(g.kllrTime).format('mm:ss:SS')}</span>
                  </Stack>
                </Stack>
              </Stack>
            </MenuItem>,
            i !== props.challenge.played.length - 1 && <Divider sx={{ my: .5 }} />
          ]
        ))}
      </Menu>
    </>
  )
}

const KillerSelector = (props: { current?: boolean, killer: Killer | null, onChange: (k: Killer | null) => void }) => {
  const autoDetection = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures && s.enableKillerDetection);
  return (
    <Stack spacing={.5} width={'100%'} alignItems={'center'} justifyContent={'center'}>
      <FormControl fullWidth>
        <InputLabel id="killer-selection-label">Killer</InputLabel>
        <Select<Killer | 'NONE'>
          fullWidth
          size='small'
          value={props.killer || 'NONE'}
          label='Killer'
          labelId='killer-selection-label'
          onChange={(e) => {
            if (e.target.value === 'NONE') props.onChange(null);
            else props.onChange(e.target.value);
          }}>
          <MenuItem value={'NONE'}>{props.current ? 'Unselected / Auto-Detect' : 'Unselected'}</MenuItem>
          {Object.values(Killer).map(k => <MenuItem value={k as Killer}>{killerToNormalCase(k)}</MenuItem>)}
        </Select>
      </FormControl>
      {props.current && <small style={{ opacity: .7 }}>Auto-detection is turned {autoDetection ? 'on' : 'off'}.</small>}
    </Stack>
  )
}

const CustomTimePicker = (props: { value: moment.Moment, onChange: (m: moment.Moment) => void, name: string, disabled?: boolean }) => {
  const minRef = useRef(0);
  const [open, setOpen] = useState(false);

  const [anchorRef, setAnchorRef] = useState<HTMLButtonElement | null>(null);

  const [editing, setEditing] = useState<TimeView>();
  useEffect(() => setEditing('minutes'), [open]);
  const t = useTheme();

  const [v, setV] = useState(props.value);
  useEffect(() => setV(props.value), [momentToMillis(props.value), open]);

  const value = useDebounce(open ? v : props.value, open ? 0 : 50);
  const hidden = props.disabled ? '--' : undefined;

  return (
    <Stack sx={t => ({ border: `1px solid ${t.palette.divider}`, borderRadius: t.shape.borderRadius + 'px', px: 1, py: .5, width: 140, ...(open ? { borderColor: t.palette.primary.main } : {}) })}>
      <Popper open={open} anchorEl={anchorRef} transition sx={{
        zIndex: theme => theme.zIndex.modal + 1,
      }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} timeout={350}>
            <Paper sx={{ position: 'relative', borderRadius: 9999, aspectRatio: '1/1', display: "flex", alignItems: 'center', justifyContent: 'center' }}>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <TimeClock
                  sx={{ width: 269 }}
                  value={value}
                  views={['minutes', 'seconds']}
                  onChange={(m, s, v) => {
                    if (v === 'minutes') {
                      minRef.current = m.minutes();
                      setV(moment(m.minutes() * 60_000 + m.seconds() * 1_000 + m.milliseconds()));
                    }
                    if (v === 'seconds') {
                      if (s === 'finish') {
                        setOpen(false);
                        props.onChange(moment(minRef.current * 60_000 + m.seconds() * 1_000));
                      } else setV(moment(minRef.current * 60_000 + m.seconds() * 1_000 + m.milliseconds()));
                    }
                  }}
                  onViewChange={v => setEditing(v)}
                />
              </ClickAwayListener>
              <Paper elevation={2} sx={{ position: 'absolute', pointerEvents: 'none', borderRadius: 9999, px: 1 }}>
                <Typography variant="overline">{editing}</Typography>
              </Paper>
            </Paper>
          </Grow>)}
      </Popper>
      <Stack fontSize={'16px'} direction={'row'} alignItems={'center'} justifyContent={'center'}>
        <Stack>
          <span style={{ fontSize: '10px', opacity: .7, whiteSpace: 'nowrap' }}>{props.name}</span>
          <Stack fontFamily={'monospace'} direction={'row'}>
            <b style={(open && editing === 'minutes') ? { color: t.palette.primary.main } : {}}>{hidden ?? value.minutes().toString().padStart(2, '0').substring(0, 2)}</b>:
            <b style={(open && editing === 'seconds') ? { color: t.palette.primary.main } : {}}>{hidden ?? value.seconds().toString().padStart(2, '0').substring(0, 2)}</b>
            <span style={{ fontSize: '13px', opacity: .5, transform: 'translate(5px, 3px)' }}>
              {hidden ?? props.value.milliseconds().toString().padStart(2, '0').substring(0, 2)}
            </span>
          </Stack>
        </Stack>
        <IconButton size="small" sx={{ my: .2, ml: 1 }} onClick={() => setOpen(!open)} ref={setAnchorRef} disabled={props.disabled}>
          {props.disabled ? <Lock /> : <Edit />}
        </IconButton>
      </Stack>
    </Stack>
  );
}
