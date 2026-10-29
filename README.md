# EnumJX

Created by [Sanket Shahane](https://sanketshahane.in/) · [GitHub profile](https://github.com/sanketshahane05/) · MIT licensed.

JavaScript enums with stable member identity, parsing, metadata, immutable flag combinations, and React select components.

```js
import { Enums, EnumSelect } from 'enumjx';

const Status = Enums.Status('Active', 'Pending', 'Done');
Status.Active === Status.fromName('active'); // true
```

The npm package exports both `Enums` and the React components from one import. [`enums.js`](./enums.js) is also a standalone ES module with no React dependency; [`enums.min.js`](./enums.min.js) is its minified build. Try the [interactive browser demo](./index.html).

The source files carry a copyright and license header. Keep the copyright and permission notice when redistributing under MIT. A source credit is visible to readers; it does not track who installs or runs the library.

## Installation

```sh
npm install enumjx
```

React is a peer dependency of the package. A React app will normally already have it. For a vanilla browser page, import the standalone core file:

```html
<script type="module">
  import { Enums } from './enums.js';
  const Status = Enums.Status('Active', 'Pending');
  console.log(Status.Active.name);
</script>
```

The [demo](./index.html) imports the standalone core module directly and runs on GitHub Pages or another static web server.

## Define enums

```js
const Command = Enums.Command('Start', 'Continue', 'Stop');
const Color = Enums.Color(['Red', 'Green', 'Blue']);
const Http = Enums.Http({ Ok: 200, NotFound: 404 });

const Status = Enums.Status([
  { Name: 'Active', Value: 'active', Label: 'Active now', Description: 'Work is running', Aliases: ['running'] },
  { Name: 'Paused', Value: 'paused', Label: 'On hold', Data: { color: 'orange' } }
]);
```

Each declaration creates an enum class. Keep it in a variable and reuse it. The members are frozen singletons:

```js
const copy = Status.Active;
copy === Status.Active;              // true
Status.fromName('running') === copy; // true
Status.Active !== Status.Paused;     // true
```

Automatic numeric values start at `1`. You can assign unique strings, finite numbers, or booleans. Member names are trimmed and their first letter is capitalized. Duplicate names, values, and conflicting aliases are rejected.

### JSON input and definition export

```js
Enums.fromJson('["Start","Stop"]', 'Command');
Enums.fromJson('{"name":"Command","members":["Start","Stop"]}');
Enums.Command('{"Start":1,"Stop":2}');

const saved = JSON.stringify(Status.toDefinition());
const RestoredStatus = Enums.fromJson(saved);
```

Member objects accept `Name` or `name`, `Value` or `value`, and similarly for `Label`, `Description`, `Aliases`, `Data`, `Deprecation`, and `DeprecatedAliases`. `toDefinition()` exports the enum name, members, metadata, flag mode, JSON mode, and case sensitivity. Restoring creates a **new** class, so restored members do not share object identity with the originals.

When the enum name comes from a variable, use `Enums.define(name, ...members)`. For typo detection in dynamic declarations, use `Enums.only(['Command', 'Status'])` to permit only those names.

## Lookup and parsing

```js
Status.fromName('active');      // Status.Active
Status.fromValue('paused');     // Status.Paused
Status.from('running');         // Status.Active, via alias
Status.parse('missing');        // throws with valid names
Status.tryParse('missing');     // null
Status.hasName('Active');       // true
Status.hasValue('paused');      // true
Status.values();                // [Status.Active, Status.Paused]
Status.names();                 // ['Active', 'Paused']
Status.entries();               // [['Active', Status.Active], ...]
```

Lookup ignores case by default. For exact spelling, pass `{ caseSensitive: true }` as the final declaration option:

```js
const State = Enums.State(['Active', 'Pending'], { caseSensitive: true });
State.fromName('Active'); // State.Active
State.fromName('active'); // null
```

For a C# style boolean result, pass an output object:

```js
const out = {};
if (Status.tryParse('active', out)) console.log(out.value === Status.Active);
```

JavaScript has no `out x` variable syntax. On failure, `out.value` becomes `null`.

### Aliases, deprecation, and custom data

```js
const Job = Enums.Job([
  { Name: 'Running', DeprecatedAliases: ['Active'], Data: { icon: 'play' } },
  { Name: 'Old', Deprecation: 'Use Running' }
]);

Job.fromName('Active') === Job.Running; // true
Job.lookup('Active').deprecated;        // true
Job.lookup('Active').message;           // 'Name Active is deprecated; use Running'
```

`lookup()` reports deprecation without logging warnings. `Data` is copied and deeply frozen, so later edits to your source object cannot change a member.

## Iterate and match

```js
for (const member of Status) console.log(member.name, member.value);

const message = Status.match(Status.Active, {
  Active: () => 'Ready',
  Paused: () => 'Waiting'
});
```

`match()` requires one function for every member and rejects missing or extra handlers and members from another enum.

## Bitwise combinations and flags

An ordinary enum supports combinations without changing member values:

```js
const Command = Enums.Command('Start', 'Continue', 'Stop');
const bits = Command.bitwise();
let selection = bits.combine([Command.Start, Command.Stop]);

selection.mask;                      // 5
bits.has(selection, Command.Start);  // true
bits.membersOf(selection);           // [Command.Start, Command.Stop]
selection.toString();                // 'Start, Stop'
selection = bits.add(selection, [Command.Continue]);
selection = bits.remove(selection, [Command.Start]);
selection = bits.toggle(selection, [Command.Stop]);
```

Use `.flags(...)` when each member's own `.value` should be a power of two:

```js
const Permission = Enums.Permission.flags('Read', 'Write', 'Delete');
Permission.Read.value;   // 1
Permission.Write.value;  // 2
Permission.Delete.value; // 4
Permission.bitwise().combine([Permission.Read, Permission.Delete]).mask; // 5
```

Combinations are immutable and belong to one enum. Masks are numbers for up to 31 members and `BigInt` for larger sets. `.flags(...)` supports up to 64 members. Unknown bits and members from another enum are rejected.

```js
bits.fromMask(selection.mask);             // restore a numeric mask
bits.fromJSON(JSON.stringify(selection)); // restore an array of member names
bits.parse('Start, Stop');                 // parse a comma-separated list
Enums.bitwise.combine(Command, [Command.Start]); // generic API
```

## Member JSON and conversion

`JSON.stringify(Status.Active)` writes an object with its name, value, and metadata. Pass `{ jsonMode: 'name' }`, `'value'`, or `'both'` as the final declaration option for shorter member JSON. Restore one member with `Status.fromJSON(parsedJson)`.

`String(Status.Active)` and `` `${Status.Active}` `` show its name. Numeric arithmetic uses its value. JavaScript gives `member + ''` and `member + 1` the same default conversion hint; use `String(member)` when you want the name.

## React components

All components come from the main `enumjx` import:

```jsx
import { useState } from 'react';
import { Enums, EnumSelect, EnumMultiSelect, EnumCombinationSelect } from 'enumjx';

const Role = Enums.Role([
  { Name: 'Admin', Label: 'Administrator' },
  { Name: 'User', Label: 'Standard user' }
]);

function RolePicker() {
  const [role, setRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [combination, setCombination] = useState(() => Role.bitwise().combine([]));

  return <>
    <EnumSelect enumType={Role} value={role} onChange={setRole} name="role" />
    <EnumMultiSelect enumType={Role} value={roles} onChange={setRoles} />
    <EnumCombinationSelect enumType={Role} value={combination} onChange={setCombination} />
  </>;
}
```

`EnumSelect` returns a member or `null`. `EnumMultiSelect` returns an array of members. `EnumCombinationSelect` returns an enum-owned combination. All accept `getLabel(member)`, `isDisabled(member)`, and standard select attributes. Native forms submit member names; use the callback member's `.value` when an API expects the assigned value.

## CDN and GitHub Pages

After the npm release, import the standalone core from a CDN without loading React:

```html
<script type="module">
  import { Enums } from 'https://cdn.jsdelivr.net/npm/enumjx@0.1.0/enums.min.js';
  const Status = Enums.Status('Active', 'Pending');
  document.body.textContent = Status.Active.name;
</script>
```

Replace `0.1.0` with the published version. Pinning the version keeps existing sites stable. For readable CDN source, use `/enums.js` instead of `/enums.min.js`. The React components are intended for React apps and bundlers.

[`index.html`](./index.html) is the Pages site. It imports `enums.js` from the same folder. The live demo is at [sanketshahane05.github.io/enumjx](https://sanketshahane05.github.io/enumjx/).

## Development and publishing

```sh
npm install
npm run check
```

`npm run check` builds `enums.min.js`, runs the JavaScript tests and TypeScript checks, and shows the npm package contents. To publish:

1. Verify that `enumjx` is available on npm. This project uses the MIT license.
2. Confirm the repository and homepage metadata in `package.json`.
3. Run `npm run check` and inspect `npm pack --dry-run` for the intended files.
4. Sign in with `npm login` and confirm with `npm whoami`.
5. Run `npm publish`. npm requires publishing authentication; follow its prompt.
6. For later releases, bump the version, rerun checks, and publish the new version.

The npm release and GitHub Pages site are separate: npm distributes library modules; Pages hosts the demo. A published name/version cannot be reused.

