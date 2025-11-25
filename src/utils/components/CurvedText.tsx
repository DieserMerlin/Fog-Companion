import { CSSProperties } from "react";

export const CurvedText = (props: { text: string, size: number | string, style?: CSSProperties }) => {
  return (
    <svg viewBox={"0 0 " + props.size + " " + props.size}>
      <path id="curve" fill="transparent" d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97" />
      <text width={props.size}>
        <textPath style={props.style} {...{ 'xlink:href': "#curve" }}>
          {props.text}
        </textPath>
      </text>
    </svg>
  );
}