import { defaultSchema, type Schema } from "hast-util-sanitize";

/** Allow GitHub-style alert divs from `remark-github-blockquote-alert`. */
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^markdown-alert/],
    ],
    p: [
      ...(defaultSchema.attributes?.p ?? []),
      ["className", /^markdown-alert/],
    ],
    h3: [
      ...(defaultSchema.attributes?.h3 ?? []),
      ["className", /^markdown-alert/],
    ],
  },
};
