export type EnumValue = string | number | boolean | bigint;
export type EnumDefinition = EnumValue | {
  value?: EnumValue;
  description?: string | null;
  label?: string | null;
  aliases?: string[];
  data?: Record<string, unknown>;
  deprecation?: true | string;
  deprecatedAliases?: string[];
};
export type MemberObject = {
  Name?: string;
  name?: string;
  Value?: EnumValue;
  value?: EnumValue;
  Description?: string | null;
  description?: string | null;
  Label?: string | null;
  label?: string | null;
  Aliases?: string[];
  aliases?: string[];
  Data?: Record<string, unknown>;
  data?: Record<string, unknown>;
  Deprecation?: true | string;
  deprecation?: true | string;
  DeprecatedAliases?: string[];
  deprecatedAliases?: string[];
};
export type EnumSource = string | readonly string[] | readonly MemberObject[] | Record<string, EnumDefinition>;
export type EnumOptions = { jsonMode?: 'object' | 'name' | 'value' | 'both'; caseSensitive?: boolean };
export type EnumDefinitionExport = {
  name: string;
  members: Array<MemberObject & { Name: string; Value: EnumValue | `${bigint}n` }>;
  flags: boolean;
  jsonMode: 'object' | 'name' | 'value' | 'both';
  caseSensitive: boolean;
};

export class EnumCombination {
  protected constructor();
  readonly mask: number | bigint;
  equals(other: EnumCombination): boolean;
  toString(): string;
  toJSON(): string[];
}

declare class EnumBase {
  readonly name: string;
  readonly value: EnumValue;
  readonly description: string | null;
  readonly label: string | null;
  readonly aliases: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly deprecation: string | null;
  readonly deprecatedAliases: readonly string[];
  protected constructor();
  toString(): string;
  valueOf(): EnumValue;
  [Symbol.toPrimitive](hint: string): EnumValue;
  toJSON(): string | number | boolean | object;
  static jsonMode: 'object' | 'name' | 'value' | 'both';
  static bitwise(): BoundBitwiseOperations;
  static toUp(name: string): string;
  static lookupKey(name: string): string;
  static toDefinition(): EnumDefinitionExport;
  static fromName(name: string, fallback?: Enums | null): Enums | null;
  static lookup(name: string): { member: Enums; matchedBy: 'name' | 'alias' | 'deprecatedAlias'; deprecated: boolean; message: string | null } | null;
  static fromValue(value: EnumValue, fallback?: Enums | null): Enums | null;
  static from(input: string | number | boolean | Enums, fallback?: Enums | null): Enums | null;
  static fromJSON(input: unknown, fallback?: Enums | null): Enums | null;
  static fromJson(input: string | readonly string[] | readonly MemberObject[] | Record<string, unknown>, enumName?: string): EnumClass;
  static define(enumName: string, ...sources: EnumSource[]): EnumClass;
  static defineFlags(enumName: string, ...sources: EnumSource[]): EnumClass;
  static parse(input: string | number | boolean | Enums): Enums;
  static tryParse(input: string | number | boolean | Enums): Enums | null;
  static tryParse(input: string | number | boolean | Enums, out: { value?: Enums | null }): boolean;
  static [Symbol.iterator](): IterableIterator<Enums>;
  static only<const Names extends readonly string[]>(names: Names): { readonly [K in Names[number]]: EnumDeclaration };
  static isValid(input: string | number | boolean | Enums): boolean;
  static hasName(name: string): boolean;
  static hasValue(value: EnumValue): boolean;
  static toString(value: EnumValue): string;
  static values(): Enums[];
  static names(): string[];
  static entries(): Array<[string, Enums]>;
  static match<T>(member: Enums, handlers: Record<string, (member: Enums) => T>): T;
  static initialize(defs: string[] | Record<string, EnumDefinition>, options?: { flags?: boolean }): typeof EnumBase;
  static printTable(): void;
}

export type Enums = EnumBase;
export type EnumClass = typeof EnumBase & Record<string, EnumBase>;
export interface BitwiseOperations {
  combine(enumClass: EnumClass, members?: Enums[]): EnumCombination;
  has(enumClass: EnumClass, combination: EnumCombination, member: Enums): boolean;
  add(enumClass: EnumClass, combination: EnumCombination, members: Enums[]): EnumCombination;
  remove(enumClass: EnumClass, combination: EnumCombination, members: Enums[]): EnumCombination;
  toggle(enumClass: EnumClass, combination: EnumCombination, members: Enums[]): EnumCombination;
  membersOf(enumClass: EnumClass, combination: EnumCombination): Enums[];
  format(enumClass: EnumClass, combination: EnumCombination): string;
  parse(enumClass: EnumClass, text: string): EnumCombination;
  fromMask(enumClass: EnumClass, mask: number | bigint): EnumCombination;
  fromJSON(enumClass: EnumClass, input: string | string[]): EnumCombination;
}
export interface BoundBitwiseOperations {
  combine(members?: Enums[]): EnumCombination;
  has(combination: EnumCombination, member: Enums): boolean;
  add(combination: EnumCombination, members: Enums[]): EnumCombination;
  remove(combination: EnumCombination, members: Enums[]): EnumCombination;
  toggle(combination: EnumCombination, members: Enums[]): EnumCombination;
  membersOf(combination: EnumCombination): Enums[];
  format(combination: EnumCombination): string;
  parse(text: string): EnumCombination;
  fromMask(mask: number | bigint): EnumCombination;
  fromJSON(input: string | string[]): EnumCombination;
}
export interface EnumDeclaration {
  (...names: string[]): EnumClass;
  (source: EnumSource, options?: EnumOptions): EnumClass;
  flags: {
    (...names: string[]): EnumClass;
    (source: EnumSource, options?: EnumOptions): EnumClass;
  };
}
export const Enums: typeof EnumBase & { bitwise: BitwiseOperations } & Record<string, EnumDeclaration>;

