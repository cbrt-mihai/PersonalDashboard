import type { en } from "@/lib/i18n/locales/en";

type WidenStrings<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? WidenStrings<T[K]>
      : T[K];
};

export type Messages = WidenStrings<typeof en>;

type Primitive = string | number | boolean | null | undefined;

export type TranslationValues = Record<string, Primitive>;

type Join<Prefix extends string, Key extends string> = Prefix extends ""
  ? Key
  : `${Prefix}.${Key}`;

export type TranslationKey<T = Messages, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<Prefix, K>
    : T[K] extends Record<string, unknown>
      ? TranslationKey<T[K], Join<Prefix, K>>
      : never;
}[keyof T & string];
