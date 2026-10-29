import type { ChangeEvent, ReactElement, SelectHTMLAttributes } from 'react';
import type { Enums, EnumCombination } from './enums.js';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'onChange' | 'multiple' | 'children'>;

export interface EnumSource<M extends Enums> {
  readonly name: string;
  values(): M[];
  fromName(name: string): M | null;
}

export type EnumSelectProps<M extends Enums> = SelectProps & {
  enumType: EnumSource<M>;
  value: M | null;
  onChange: (member: M | null, event: ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string | null;
  getLabel?: (member: M) => string;
  isDisabled?: (member: M) => boolean;
};

export type EnumMultiSelectProps<M extends Enums> = SelectProps & {
  enumType: EnumSource<M>;
  value: readonly M[];
  onChange: (members: M[], event: ChangeEvent<HTMLSelectElement>) => void;
  getLabel?: (member: M) => string;
  isDisabled?: (member: M) => boolean;
};

export type EnumCombinationSelectProps<M extends Enums> = SelectProps & {
  enumType: EnumSource<M> & { bitwise(): {
    membersOf(value: EnumCombination): M[];
    combine(members: M[]): EnumCombination;
  } };
  value: EnumCombination;
  onChange: (selection: EnumCombination, event: ChangeEvent<HTMLSelectElement>) => void;
  getLabel?: (member: M) => string;
  isDisabled?: (member: M) => boolean;
};

export function EnumSelect<M extends Enums>(props: EnumSelectProps<M>): ReactElement;
export function EnumMultiSelect<M extends Enums>(props: EnumMultiSelectProps<M>): ReactElement;
export function EnumCombinationSelect<M extends Enums>(props: EnumCombinationSelectProps<M>): ReactElement;

