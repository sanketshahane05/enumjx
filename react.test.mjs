// EnumJX © 2026 Sanket Shahane — https://sanketshahane.in/ — https://github.com/sanketshahane05/ — MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Enums, EnumSelect, EnumMultiSelect, EnumCombinationSelect } from 'enumjx';

const Role = Enums.Role([
    { Name: 'Admin', Value: 'admin', Label: 'Administrator' },
    { Name: 'User', Value: 'user', Data: { disabled: true } }
]);

test('single select renders labels and returns the original member', () => {
    let selected;
    const props = { enumType: Role, value: Role.Admin, onChange: member => { selected = member; }, isDisabled: member => member.data.disabled === true };
    const html = renderToStaticMarkup(createElement(EnumSelect, props));
    assert.match(html, /value="Admin" selected=""/);
    assert.match(html, />Administrator<\/option>/);
    assert.match(html, /value="User" disabled=""/);
    const element = EnumSelect(props);
    element.props.onChange({ currentTarget: { value: 'User' } });
    assert.equal(selected, Role.User);
    element.props.onChange({ currentTarget: { value: '' } });
    assert.equal(selected, null);
    assert.throws(() => EnumSelect({ ...props, value: Enums.Other('Admin').Admin }), /Expected a Role member/);
});

test('multi select returns members rather than DOM strings', () => {
    let selected;
    const props = { enumType: Role, value: [Role.Admin], onChange: members => { selected = members; } };
    const html = renderToStaticMarkup(createElement(EnumMultiSelect, props));
    assert.match(html, /multiple=""/);
    const element = EnumMultiSelect(props);
    element.props.onChange({ currentTarget: { selectedOptions: [{ value: 'Admin' }, { value: 'User' }] } });
    assert.deepEqual(selected, [Role.Admin, Role.User]);
});

test('combination select returns an enum-owned combination', () => {
    const bits = Role.bitwise();
    let selected;
    const props = { enumType: Role, value: bits.combine([Role.Admin]), onChange: combination => { selected = combination; } };
    const element = EnumCombinationSelect(props);
    element.props.onChange({ currentTarget: { selectedOptions: [{ value: 'User' }] } });
    assert.deepEqual(bits.membersOf(selected), [Role.User]);
});

