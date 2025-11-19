import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogContent from "@mui/material/DialogContent"
import Link, { LinkProps } from "@mui/material/Link"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import { useState } from "react"

export type OverwolfLinkProps = LinkProps & {
  href: string
}

export const OverwolfLink = (props: LinkProps) => <Link {...props} onClick={() => overwolf.utils.openUrlInOverwolfBrowser(props.href)} />

export const ConfirmOpenLinkExternally = (props: LinkProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogContent>
          <Stack spacing={2}>
            <span>This will open the following link in your browser:</span>
            <Paper sx={{p: 1}}>{props.href}</Paper>
            <Stack direction={'row'} spacing={1}>
              <Button variant="text" color="error" onClick={() => setOpen(false)}>Abort</Button>
              <Button variant="contained" color="info" onClick={() => {
                setOpen(false);
                overwolf.utils.openUrlInDefaultBrowser(props.href);
              }}>
                Continue
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
      <Link {...props} onClick={e => {
        e.preventDefault();
        setOpen(true);
      }} />
    </>
  )
}