import { ArrowBackIos } from '@mui/icons-material';
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from '@mui/material/Chip';
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { forwardRef, PropsWithChildren, useEffect, useMemo, useState } from "react";
import { ALLOWED_FILE_EXTENSIONS, CustomProvider, MapFileEntry, MapResolver } from "../../../game_state/GameState";
import Select from '@mui/material/Select';
import { MapDirectory } from '../../../generated-map-directory';
import MenuItem from '@mui/material/MenuItem';
import Link from '@mui/material/Link';
import Badge from '@mui/material/Badge';
import { Folder, Map, WarningAmber } from '@mui/icons-material';
import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { useTreeItemModel } from '@mui/x-tree-view/hooks';
import Alert from '@mui/material/Alert';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';

type TreeNode = {
  id: string;
  label: string;
  item?: { entry: MapFileEntry; matchesKnown?: string };
  children?: TreeNode[];
};

type TreeStructure = TreeNode[];

// Renders each item and picks the right icon + styling based on our custom fields
const CustomTreeItem = forwardRef<HTMLLIElement, TreeItemProps>(function CustomTreeItem(
  props,
  ref,
) {
  // Access the *full* item (your TreeNode) by itemId
  const item = useTreeItemModel<TreeNode>(props.itemId);

  const isFolder = !item?.item; // folders have no "item"
  const matchesKnown = item?.item?.matchesKnown;

  // Decide the icon to show
  const Icon = isFolder
    ? Folder
    : !matchesKnown
      ? WarningAmber
      : Map;

  // If it's a file and matchesKnown === true, wrap the Map icon with a green dot Badge
  const iconSlot =
    !isFolder && !!matchesKnown ? (
      <Badge variant="dot" color="success" overlap="circular">
        <Map fontSize="small" />
      </Badge>
    ) : (
      <Icon fontSize="small" />
    );

  // If it's a file and matchesKnown === false, make the row red
  const redRow =
    !isFolder && !matchesKnown
      ? {
        sx: {
          bgcolor: 'error.main',
          color: 'common.white',
          borderRadius: 1,
          '& .MuiSvgIcon-root': { color: 'inherit' },
        },
      }
      : undefined;

  return (
    <TreeItem
      ref={ref}
      {...props}
      // Replace the built-in icon slot for this item only
      slots={{ icon: () => iconSlot }}
      // Style the content slot conditionally (when redRow is set)
      slotProps={{
        content: redRow as any, // content slot accepts Box props (sx etc.)
      }}
    />
  );
});

const KnownMaps = [...new Set(Object.values(MapDirectory).flat().map(map => MapResolver.Instance().baseName(map)))];

const CopyMapName = (props: { open: boolean, setOpen: (open: boolean) => void }) => {
  const [copied, setCopied] = useState(false);

  const copyDone = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <Select
      disabled={copied}
      open={props.open}
      onOpen={() => props.setOpen(true)}
      onClose={() => props.setOpen(false)}
      onChange={(e) => { overwolf.utils.placeOnClipboard(e.target.value + ' _1_'); copyDone(); }}
      size='small'
      value={'placeholder'}
    >
      <MenuItem value={'placeholder'} style={{ pointerEvents: 'none' }}>{copied ? 'Copied! Use Ctrl+V now!' : 'Select Map to copy filename'}</MenuItem>
      {KnownMaps.map(map => <MenuItem key={map} value={map}>{map}</MenuItem>)}
    </Select>
  );
}

const FileNameExamples = (props: { variants?: boolean }) => {
  const [fileName, setFileName] = useState<{ map: string, variant: number, extension: string } | null>(null);

  useEffect(() => {
    let i = 0;
    const pick = () => {
      const mapIndex = (props.variants ? Math.floor(i / 3) : i) % KnownMaps.length;
      const map = KnownMaps[mapIndex];
      const variant = props.variants ? (i % 3 + 1) : 0;
      const extension = ALLOWED_FILE_EXTENSIONS[i % ALLOWED_FILE_EXTENSIONS.length];
      setFileName({ map, variant, extension });
      i++;
    }
    const interval = setInterval(pick, props.variants ? 500 : 1500);
    pick();
    return () => clearInterval(interval);
  }, [])

  if (!fileName) return null;
  return <>{fileName.map}{fileName.variant ? <> _{fileName.variant}_</> : ''}<span style={{ opacity: .6 }}>.{fileName.extension}</span></>
}

const Step = (props: PropsWithChildren<{ ready: boolean, conditionOrLabel: boolean | string | number }>) => {
  return <FormControlLabel sx={{ opacity: props.ready ? 1 : .4 }} control={typeof props.conditionOrLabel === 'boolean' ? <Checkbox checked={props.conditionOrLabel} /> : <Typography variant='h5' style={{ margin: '14px' }}>{props.conditionOrLabel}</Typography>} label={props.children} />
}

export const AppCustomMapSettings = (props: { onClose: () => void }) => {
  const [data, setData] = useState<{
    customFolder: string;
    customFolderExists: boolean;
    customMaps: TreeStructure;
  }>({ customFolder: '', customFolderExists: false, customMaps: [] });

  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (loading) return;
    setLoading(true);
    const instance = CustomProvider.Instance();
    const resolverInstance = MapResolver.Instance();

    console.log({ instance, resolverInstance });

    await resolverInstance.reloadCache();

    const { basePath, exists } = await instance.folderExists();
    const list = await instance.list();

    console.log({ basePath, exists, list });

    const out: TreeStructure = [{ id: basePath, label: 'CustomMaps', children: [] }];

    for (const entry of list) {
      let relative = entry.fullPath.replace(basePath, '');
      relative = relative.replace(/^\\/, '');

      const path = relative.split('\\');
      let parent = out[0];

      for (let i = 0; i < path.length; i++) {
        const id = [basePath, ...path.slice(0, i + 1)].join('\\');
        const label = path[i];

        if (i === (path.length - 1)) { // Last part is file name, so push to folder
          if (!parent.children) parent.children = [];

          const matchesKnown = KnownMaps.find(m =>
            resolverInstance.normalizeForMatch(resolverInstance.baseName(m)) ===
            resolverInstance.normalizeForMatch(resolverInstance.baseName(entry.fileName))
          );

          parent.children.push({ id, label, item: { entry, matchesKnown } });
          continue;
        }

        const existing = parent.children?.find(p => p.id === id);

        if (existing) {
          if (!existing.children) existing.children = [];
          parent = existing
        } else {
          parent.children.push((parent = { id, label, children: [] }))
        }
      }
    }

    console.log(out);

    setData({ customFolder: basePath, customFolderExists: exists, customMaps: out });
    setLoading(false);
    setSelected(null);
  }

  useEffect(() => { loadData() }, []);
  const allTreeItems = useMemo(
    () => (function f(a: TreeStructure): TreeStructure {
      return a.flatMap(n => [n, ...(n.children ? f(n.children) : [])]);
    })(data.customMaps),
    [data.customMaps]
  );

  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    setExpanded(allTreeItems.filter(i => i.children?.length).map(i => i.id));
  }, [allTreeItems]);

  const [pickerOpen, setPickerOpen] = useState(false);

  const conditionStep1 = data.customFolderExists;
  const conditionStep2 = conditionStep1 && allTreeItems.some(i => !!i.item);
  const conditionStep3 = conditionStep2 && allTreeItems.some(i => !!i.item && /_\d_\.[a-z]+$/gi.test(i.item.entry.fileName));

  const [selected, setSelected] = useState<TreeNode | null>(null);
  const onSelect = (id: string) => {
    const item = allTreeItems.find(i => i.id === id && !!i.item);
    setSelected(item || null);
  }

  return (
    <DialogContent
      sx={{
        // Create a full-height column so our app can size to the viewport
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        pt: 'var(--winbar-h)', // keep dialog below the fixed header
      }}
    >
      <Stack
        // This is the root column inside DialogContent
        sx={{
          height: '100%',          // fill DialogContent
          overflow: 'hidden',      // only children scroll, header stays fixed
        }}
        spacing={0}               // tighter; we’ll use Divider for separation
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 4,
            pb: 2,
            flexShrink: 0,                         // <- important
            zIndex: 1,
          }}
        >
          <IconButton onClick={props.onClose}><ArrowBackIos /></IconButton>
          <Stack flexGrow={1}>
            <Typography variant="h5">Custom Graphics Manager</Typography>
            <span style={{ opacity: .6 }}>Replace the default callout graphics with your own ones!</span>
          </Stack>
          <Stack>
            <Button variant="outlined" onClick={loadData}>Refresh Folder Contents</Button>
            <CopyMapName open={pickerOpen} setOpen={setPickerOpen} />
          </Stack>
        </Stack>
        <Divider />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            p: 4,
            pt: 2,
            flexGrow: 1,           // take remaining height
            minHeight: 0,          // <- critical so children can shrink/scroll
            overflow: 'hidden',    // children manage their own scroll
          }}
        >
          <Stack
            sx={{
              height: '100%',
              width: '40%',
              minWidth: 0,          // allow shrinking
              minHeight: 0,         // allow internal scroll
              overflow: 'hidden',     // this pane scrolls if needed
            }}
            spacing={1}
          >
            <Typography variant="overline">
              Browser
            </Typography>
            {!data.customFolderExists ? (
              <Stack width={'100%'} height={'100%'} justifyContent={'center'}>
                <Alert severity='warning' variant='outlined'>
                  <b>CustomMaps</b> folder does not exist. Follow the steps to create it.
                  <br />Hit <Link onClick={loadData}>Refresh Folder Contents</Link> to refresh!
                </Alert>
              </Stack>
            ) : (
              <Stack
                sx={{
                  height: '100%',
                  width: '40%',
                  minWidth: 0,          // allow shrinking
                  minHeight: 0,         // allow internal scroll
                  overflow: 'auto',     // this pane scrolls if needed
                }}
                spacing={1}
              >
                <RichTreeView<TreeNode>
                  // @ts-expect-error
                  selectedItems={selected?.id ?? null}

                  onSelectedItemsChange={(_, itemIds) => {
                    const nextId = Array.isArray(itemIds) ? itemIds[0] : itemIds; // normalize
                    onSelect(nextId ?? '');
                  }}
                  items={data.customFolderExists ? data.customMaps : []}
                  expandedItems={expanded}
                  onExpandedItemsChange={(_, ids) => setExpanded(ids as string[])}
                  // These generics/derivers keep TS happy
                  getItemId={(n) => n.id}
                  getItemLabel={(n) => n.label}
                  getItemChildren={(n) => n.children ?? []}
                  // Use our custom item to render icons + status styles
                  slots={{ item: CustomTreeItem }}
                />
              </Stack>)}
          </Stack>
          <Stack
            sx={{
              height: '100%',
              width: '60%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',   // CardContent will handle scroll
            }}
            spacing={1}
          >
            <Typography variant="overline">
              Details
            </Typography>
            <Stack maxHeight={'100%'} height={'100%'} width={'100%'} alignItems={'center'} justifyContent={'center'} flexGrow={1} overflow={'hidden'}>
              <Card
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,                    // allow CardContent to shrink
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    minHeight: 0,                  // <- critical
                    overflow: 'auto',              // this is the scrollable area
                  }}
                >
                  {!selected && <>
                    <Stack>
                      <Typography variant="h6">How does it work?</Typography>
                      <small style={{ opacity: .6 }}>Follow these steps to get started!</small>
                    </Stack>
                    <Stack p={2} spacing={1}>
                      <Step ready conditionOrLabel={conditionStep1}>
                        <Stack>
                          <span>Create the <b>CustomMaps</b> folder.</span>
                          <small><Link onClick={() => overwolf.utils.openWindowsExplorer('overwolf://media/screenshots/Fog Companion', console.log)}>Open your explorer</Link> and create this folder: <Chip size='small' label={data.customFolder.split('\\').map(part => (part === 'CustomMaps' ? <b>CustomMaps</b> : <span>{part} / </span>))} /></small>
                        </Stack>
                      </Step>
                      <Step ready={conditionStep1} conditionOrLabel={conditionStep2}>
                        <Stack>
                          <span>Place your first graphic.</span>
                          <small>Place an image file in the folder, named after the map you target. Use the <Link onClick={() => setPickerOpen(true)}><b>picker</b></Link> above to copy file names fast.</small>
                          <small>Allowed file extensions: {ALLOWED_FILE_EXTENSIONS.map(e => <Chip size='small' label={'.' + e} />)} Examples: <Chip size='small' label={<FileNameExamples />} /></small>
                        </Stack>
                      </Step>
                      <Step ready={conditionStep2} conditionOrLabel={conditionStep3}>
                        <Stack>
                          <span>Create variants</span>
                          <small>Suffix your file names with <Chip size='small' label={<>_<i>&lt;NUMBER&gt;</i>_</>} /> Examples: <Chip size='small' label={<FileNameExamples variants />} /></small>
                        </Stack>
                      </Step>
                      <Step ready={conditionStep2} conditionOrLabel={4}>
                        <Stack>
                          <span>See if it works!</span>
                          <small>Click <Link onClick={loadData}>Refresh Folder Contents</Link> (above) to re-index your files.</small>
                          <small>Select your Graphic on the Browser (left) to see their details.</small>
                        </Stack>
                      </Step>
                    </Stack>
                  </>}
                  {!!selected && (
                    <Stack spacing={1}>
                      <Typography variant='h6'>{selected.item.entry.fileName} {!!selected.item.matchesKnown && <Chip label={<>Auto detect on: <b>{selected.item.matchesKnown}</b></>} />}</Typography>
                      {!selected.item.matchesKnown && <Chip color='error' label="Map not recognized. The auto-detection won't work." />}
                      <Stack spacing={1} p={2} width={'100%'} height={'100%'} justifyContent={'center'} alignItems={'center'}>
                        <Typography variant='overline'>Preview:</Typography>
                        <Box
                          sx={{
                            width: 'min(100%, 300px)', // cap at 300px, but shrink with parent
                            aspectRatio: '1 / 1',      // always square
                            backgroundImage: `url(${selected.item.entry.imageUrl})`,
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: 'contain',
                            borderRadius: 1,
                          }}
                        />
                        <small>If you don't see your image here check it's file type is correct.</small>
                      </Stack>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Stack >
        </Stack >
      </Stack>
    </DialogContent>
  )
};