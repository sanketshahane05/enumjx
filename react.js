/*! @license EnumJX — MIT License
 * Copyright (c) 2026 Sanket Shahane
 * https://sanketshahane.in/
 * https://github.com/sanketshahane05/
 */
import { createElement } from 'react';

function optionsFor(enumType, getLabel, isDisabled) {
    return enumType.values().map(member => createElement('option', {
        key: member.name,
        value: member.name,
        disabled: isDisabled?.(member) ?? false
    }, getLabel?.(member) ?? member.label ?? member.name));
}

function selectedMembers(enumType, event) {
    return Array.from(event.currentTarget.selectedOptions, option => {
        const member = enumType.fromName(option.value);
        if (!member) throw new RangeError(`Unknown ${enumType.name} option: ${option.value}`);
        return member;
    });
}

export function EnumSelect({ enumType, value = null, onChange, placeholder = 'Select an option', getLabel, isDisabled, ...selectProps }) {
    if (value !== null && !enumType.values().includes(value)) throw new TypeError(`Expected a ${enumType.name} member`);
    const options = optionsFor(enumType, getLabel, isDisabled);
    if (placeholder !== null) {
        options.unshift(createElement('option', { key: '', value: '' }, placeholder));
    }
    return createElement('select', {
        ...selectProps,
        value: value?.name ?? '',
        onChange: event => onChange(event.currentTarget.value === '' ? null : enumType.fromName(event.currentTarget.value), event)
    }, options);
}

export function EnumMultiSelect({ enumType, value = [], onChange, getLabel, isDisabled, ...selectProps }) {
    if (!Array.isArray(value) || value.some(member => !enumType.values().includes(member))) {
        throw new TypeError(`Expected an array of ${enumType.name} members`);
    }
    return createElement('select', {
        ...selectProps,
        multiple: true,
        value: value.map(member => member.name),
        onChange: event => onChange(selectedMembers(enumType, event), event)
    }, optionsFor(enumType, getLabel, isDisabled));
}

export function EnumCombinationSelect({ enumType, value, onChange, getLabel, isDisabled, ...selectProps }) {
    const bits = enumType.bitwise();
    const selected = bits.membersOf(value);
    return createElement('select', {
        ...selectProps,
        multiple: true,
        value: selected.map(member => member.name),
        onChange: event => onChange(bits.combine(selectedMembers(enumType, event)), event)
    }, optionsFor(enumType, getLabel, isDisabled));
}

