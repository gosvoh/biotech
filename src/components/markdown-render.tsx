"use client";

import MarkdownEditor from "@uiw/react-md-editor/nohighlight";
import { Root } from "hast";

const { Markdown } = MarkdownEditor;

declare module "hast" {
  interface Root extends Element {
    tagName: string;
  }

  interface Element {
    tagName: string;
  }
}

export const rehypeRewrite: React.ComponentProps<
  typeof Markdown
>["rehypeRewrite"] = (node: Root, _, parent) => {
  if (node.tagName === "a") {
    if (parent && /^h(1|2|3|4|5|6)/.test(parent.tagName)) {
      parent.children = parent.children.slice(1);
    } else {
      node.properties = {
        ...node.properties,
        target: "_blank",
      };
    }
  }
};

export default function MarkdownRender(
  props: React.ComponentProps<typeof Markdown>
) {
  return <Markdown {...props} rehypeRewrite={rehypeRewrite} />;
}
