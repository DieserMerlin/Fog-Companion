import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { SettingsHotkey } from "./AppSettingsHotkey";
import { ArrowForwardIos, ArrowBackIos } from '@mui/icons-material';

function KeyRow({
  leftLabel,
  rightLabel,
  children,
}: {
  leftLabel?: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Left width-reserver (in flow, hidden but takes space) */}
      <Typography
        variant="caption"
        sx={{ visibility: "hidden", whiteSpace: "nowrap", justifySelf: "end" }}
      >
        {leftLabel ?? ""}
      </Typography>

      {/* Center: keys + absolutely positioned visible labels */}
      <Box
        sx={{
          justifySelf: "center",
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {leftLabel && (
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              right: "100%",
              pr: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {leftLabel}
          </Typography>
        )}

        <Box sx={{ display: "inline-flex", gap: 0.5 }}>
          {children}
        </Box>

        {rightLabel && (
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              left: "100%",
              pl: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {rightLabel}
          </Typography>
        )}
      </Box>

      {/* Right width-reserver */}
      <Typography
        variant="caption"
        sx={{ visibility: "hidden", whiteSpace: "nowrap", justifySelf: "start" }}
      >
        {rightLabel ?? ""}
      </Typography>
    </>
  );
}

export const MapBrowserHotkeys = () => {
  return (
    <Box
      sx={{
        display: "grid",
        // Side columns size to the widest hidden label on each side.
        gridTemplateColumns: "max-content auto max-content",
        alignItems: "center",
        rowGap: 0.75,
      }}
    >
      {/* Up */}
      <KeyRow leftLabel="Navigate Up —">
        <SettingsHotkey name="map_browser_up" small startIcon={<ArrowForwardIos style={{ transform: 'rotate(-90deg)', opacity: .5 }} />} />
      </KeyRow>

      {/* Left / Right (last label on the right) */}
      <KeyRow
        leftLabel="Navigate Back —"
        rightLabel="— Navigate Forward"
      >
        <Stack direction="row" spacing={0.5}>
          <SettingsHotkey name="map_browser_left" small startIcon={<ArrowBackIos style={{ opacity: .5 }} />} />
          <SettingsHotkey name="map_browser_right" small startIcon={<ArrowForwardIos style={{ opacity: .5 }} />} />
        </Stack>
      </KeyRow>

      {/* Down */}
      <KeyRow rightLabel="— Navigate Down">
        <SettingsHotkey name="map_browser_down" small startIcon={<ArrowForwardIos style={{ transform: 'rotate(90deg)', opacity: .5 }} />} />
      </KeyRow>
    </Box>
  );
};
