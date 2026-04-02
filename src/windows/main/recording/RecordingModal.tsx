import { FiberManualRecord, FolderOpen, Stop } from '@mui/icons-material';
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import JSZip from 'jszip';
import { useState } from 'react';
import { BACKGROUND_SETTINGS } from '../../background/background-settings';
import { OcrRecordingCycle, useRecording } from './recording-store';

function formatTs(ts: number) {
  return new Date(ts).toISOString().replace(/[:.]/g, '-');
}

function cycleToText(cycle: OcrRecordingCycle): string {
  const lines: string[] = [
    `=== ${new Date(cycle.ts).toISOString()} ===`,
    '',
    `Game state: ${cycle.gameState.type}`,
    cycle.gameState.killer ? `Killer: ${cycle.gameState.killer}` : '',
    cycle.gameState.map ? `Map: ${cycle.gameState.map.name}` : '',
    cycle.gameState.detectedBy ? `Detected by: ${cycle.gameState.detectedBy}` : '',
    '',
    '--- OCR Results ---',
  ];

  for (const [id, result] of Object.entries(cycle.ocrResult)) {
    if (!result) continue;
    if (result.type === 'ocr') {
      lines.push(`${id}: [${result.text.join(' | ')}] (confidence: ${result.confidence.toFixed(2)})`);
    } else if (result.type === 'pure-black') {
      lines.push(`${id}: pure-black passed=${result.passed} ratio=${result.ratio.toFixed(3)}`);
    }
  }

  return lines.filter(l => l !== null).join('\n');
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

async function buildZip(cycles: OcrRecordingCycle[]): Promise<Blob> {
  const zip = new JSZip();

  for (const cycle of cycles) {
    const name = formatTs(cycle.ts);
    zip.file(`${name}.txt`, cycleToText(cycle));

    if (cycle.screenshotDataUrl) {
      zip.file(`${name}.png`, dataUrlToBase64(cycle.screenshotDataUrl), { base64: true });
    }

    for (const [id, dataUrl] of Object.entries(cycle.canvasDataUrls)) {
      zip.file(`${name}-${id}.png`, dataUrlToBase64(dataUrl), { base64: true });
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openDownloadsFolder() {
  try {
    const paths = (overwolf.io as any).paths;
    const dir = paths?.downloads ?? `${paths?.localAppData?.replace('AppData\\Local', '')}Downloads`;
    (overwolf.utils as any).openFolderInExplorer(dir);
  } catch {
    // fallback: open via shell if available
  }
}

export function RecordingModal() {
  const open = useRecording(s => s.open);
  const active = useRecording(s => s.active);
  const cycles = useRecording(s => s.cycles);
  const stateTransitions = useRecording(s => s.stateTransitions);
  const exportedFileName = useRecording(s => s.exportedFileName);
  const [exporting, setExporting] = useState(false);

  const screenshotCount = cycles.filter(c => c.screenshotDataUrl).length;

  const startRecording = () => {
    useRecording.setState({ active: true, cycles: [], stateTransitions: 0, lastStateType: null, exportedFileName: null });
    BACKGROUND_SETTINGS.update({ enableOcrRecording: true });
  };

  const stopRecording = async () => {
    BACKGROUND_SETTINGS.update({ enableOcrRecording: false });
    useRecording.setState({ active: false });

    const snapshot = useRecording.getState().cycles;
    if (!snapshot.length) return;

    setExporting(true);
    try {
      const blob = await buildZip(snapshot);
      const fileName = `ocr-recording-${formatTs(Date.now())}.zip`;
      triggerDownload(blob, fileName);
      useRecording.setState({ exportedFileName: fileName });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => useRecording.setState({ open: false })} maxWidth="xs" fullWidth>
      <DialogTitle>OCR Recording</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {!active && !exportedFileName && (
            <Typography variant="body2" color="text.secondary">
              Records every OCR cycle (game state, recognized text, screenshots, canvas drawings) and exports a ZIP to Downloads.
            </Typography>
          )}

          {active && (
            <Stack spacing={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <FiberManualRecord color="error" fontSize="small" sx={{ animation: 'pulse 1s infinite' }} />
                <Typography variant="body2" fontWeight="bold">Recording…</Typography>
              </Box>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Cycles captured</Typography>
                <Typography variant="body2" fontWeight="bold">{cycles.length}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Screenshots</Typography>
                <Typography variant="body2" fontWeight="bold">{screenshotCount}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">State transitions</Typography>
                <Typography variant="body2" fontWeight="bold">{stateTransitions}</Typography>
              </Stack>
            </Stack>
          )}

          {exportedFileName && !active && (
            <Stack spacing={1}>
              <Typography variant="body2" color="success.main">
                Saved <b>{exportedFileName}</b> to Downloads.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<FolderOpen />}
                onClick={openDownloadsFolder}
                size="small"
              >
                Open Downloads Folder
              </Button>
            </Stack>
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {!active ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<FiberManualRecord />}
                onClick={startRecording}
                disabled={exporting}
              >
                {exporting ? <CircularProgress size={16} /> : 'Start Recording'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="inherit"
                startIcon={<Stop />}
                onClick={stopRecording}
              >
                Stop & Export
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
