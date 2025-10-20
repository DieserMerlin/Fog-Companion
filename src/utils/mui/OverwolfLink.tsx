import Link, { LinkProps } from "@mui/material/Link"

export type OverwolfLinkProps = LinkProps & {
  href: string
}

export const OverwolfLink = (props: LinkProps) => <Link {...props} onClick={() => overwolf.utils.openUrlInOverwolfBrowser(props.href)} />
