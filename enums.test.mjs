import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Enums } from './enums.js';
import { Enums as MinifiedEnums } from './enums.min.js';

test('minified browser module exports the same enum behavior', () => {
    const Status = MinifiedEnums.Status('Active', 'Paused');
    assert.equal(Status.fromName('active'), Status.Active);
    assert.equal(Status.bitwise().combine([Status.Active]).mask, 1);
});

test('browser demo imports the core module instead of embedding it', async () => {
    const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
    assert.match(html, /<script type="module">\s*import \{ Enums \} from '\.\/enums\.js';/);
    assert.doesNotMatch(html, /class EnumCombination/);
    assert.match(html, /id="result"/);
    assert.match(html, /id="flags"/);
});

test('dynamic declarations accept names, arrays, objects, and JSON', () => {
    const Commands = Enums.APICommand('Start', 'Stop', 'Continue');
    assert.equal(Commands.Stop.value, 2);
    assert.equal(Commands.fromName('start'), Commands.Start);

    const Status = Enums.Status(['InProgress', 'Done']);
    assert.equal(Status.InProgress.name, 'InProgress');

    const Mode = Enums.Mode({ auto: 1, manual: { value: 2, label: 'Manual' } });
    assert.equal(Mode.Manual.label, 'Manual');

    const FromString = Enums.Other('["One", "Two"]');
    assert.equal(FromString.Two.value, 2);

    const FromEnvelope = Enums.fromJson('{"name":"FromJSON","members":["A","B"]}');
    assert.equal(FromEnvelope.B.value, 2);

    const FromJsonArray = Enums.fromJson('["Read", "Write"]', 'Permission');
    assert.equal(FromJsonArray.Read.value, 1);
    const FromJsonObject = Enums.fromJson('{"Start":1,"Stop":2}', 'FromObject');
    assert.equal(FromJsonObject.Stop.value, 2);
    const FromSingleJsonString = Enums.fromJson('"Only"', 'Single');
    assert.equal(FromSingleJsonString.Only.value, 1);
    const FromPlainString = Enums.APICommand('Only');
    assert.equal(FromPlainString.Only.value, 1);
    const FromAlias = Enums.fromJSON('{"name":"Alias","members":["One"]}');
    assert.equal(FromAlias.One.value, 1);
    const JsonMode = Enums.Output(['A'], { jsonMode: 'both' });
    assert.deepEqual(JSON.parse(JSON.stringify(JsonMode.A)), { name: 'A', value: 1 });
    const FlagEnvelope = Enums.fromJson('{"name":"EnvelopeFlags","flags":true,"members":["Read","Write"]}');
    assert.equal(FlagEnvelope.Write.value, 2);

    assert.throws(() => Enums.fromJson('not JSON', 'Bad'), SyntaxError);
    assert.throws(() => Enums.APICommand(), TypeError);
});

test('member object arrays accept PascalCase metadata', () => {
    const Command = Enums.Command([
        { Name: 'Start', Description: 'Begins work', Label: 'Start now', Aliases: ['begin'] },
        { Name: 'Stop', Value: 10, Description: 'Ends work' }
    ]);
    assert.equal(Command.Start.description, 'Begins work');
    assert.equal(Command.Start.label, 'Start now');
    assert.equal(Command.fromName('BEGIN'), Command.Start);
    assert.equal(Command.Stop.value, 10);
    assert.throws(() => Enums.Bad([{ Name: 'A' }, { Name: 'a' }]), /Entry 2: duplicate name a \(first used in entry 1\)/);
});

test('members are singletons with preserved names and case-insensitive lookup', () => {
    const Status = Enums.Status(['InProgress', 'Done']);
    assert.equal(Status.InProgress.name, 'InProgress');
    assert.equal(Status.fromName('inprogress'), Status.InProgress);
    assert.equal(Status.InProgress, Status.InProgress);
    assert.throws(() => new Status('Fake', 3), TypeError);
    assert.throws(() => Enums.Status(['InProgress', 'inprogress']), /entry 2: duplicate name Inprogress/);
});

test('member coercion keeps arithmetic numeric and explicit string conversion named', () => {
    const Command = Enums.Command([{ Name: 'Start', Value: 1, Label: 'Begin', Aliases: ['run'] }]);
    assert.equal(Command.Start + 1, 2);
    assert.equal(Command.Start + '', '1');
    assert.equal(String(Command.Start), 'Start');
    assert.equal(`Command: ${Command.Start}`, 'Command: Start');
    assert.equal(Number(Command.Start), 1);
    assert.equal(Command.Start.value + 1, 2);
    const json = JSON.parse(JSON.stringify(Command.Start));
    assert.deepEqual(json, { name: 'Start', value: 1, description: null, label: 'Begin', aliases: ['Run'], data: {}, deprecation: null, deprecatedAliases: [] });
    assert.equal(Command.fromJSON(json), Command.Start);
    const NameOnly = Enums.NameOnly('One', { jsonMode: 'name' });
    assert.equal(JSON.stringify(NameOnly.One), '"One"');
});

test('custom data is copied and old names remain discoverable', () => {
    const source = { color: 'green', ui: { icon: 'play' } };
    const Status = Enums.Status([
        { Name: 'Running', Data: source, DeprecatedAliases: ['Active'] },
        { Name: 'Old', Deprecation: 'Use Running' }
    ]);
    source.ui.icon = 'changed';
    assert.equal(Status.Running.data.ui.icon, 'play');
    assert.equal(Object.isFrozen(Status.Running.data.ui), true);
    assert.equal(Status.fromName('active'), Status.Running);
    assert.deepEqual(Status.lookup('Active'), {
        member: Status.Running, matchedBy: 'deprecatedAlias', deprecated: true,
        message: 'Name Active is deprecated; use Running'
    });
    assert.equal(Status.lookup('Running').deprecated, false);
    assert.equal(Status.lookup('Old').message, 'Use Running');
    assert.equal(JSON.parse(JSON.stringify(Status.Running)).data.ui.icon, 'play');
});

test('large combinations use BigInt while small ones keep numbers', () => {
    const names = Array.from({ length: 40 }, (_, index) => `Item${index}`);
    const Large = Enums.Large(names);
    const selection = Large.bitwise().combine([Large.Item0, Large.Item39]);
    assert.equal(selection.mask, 1n | (1n << 39n));
    assert.equal(Large.bitwise().has(selection, Large.Item39), true);
    assert.equal(Large.bitwise().fromJSON(JSON.stringify(selection)).equals(selection), true);
    const Flags = Enums.Flags.flags(names);
    assert.equal(Flags.Item39.value, 1n << 39n);
    const flagSelection = Flags.bitwise().combine([Flags.Item0, Flags.Item39]);
    assert.equal(flagSelection.mask, 1n | (1n << 39n));
    assert.equal(Flags.fromJSON(JSON.parse(JSON.stringify(Flags.Item39))), Flags.Item39);
    assert.equal(typeof Enums.Small('A').bitwise().combine([]).mask, 'number');
    const sixtyFour = Array.from({ length: 64 }, (_, index) => `Flag${index}`);
    const MaxFlags = Enums.MaxFlags.flags(sixtyFour);
    assert.equal(MaxFlags.Flag63.value, 1n << 63n);
    assert.equal(MaxFlags.bitwise().combine([MaxFlags.Flag63]).mask, 1n << 63n);
    assert.throws(() => Enums.TooMany.flags([...sixtyFour, 'Flag64']), /at most 64/);
});

test('flag mode stays private and does not occupy a member name', () => {
    const Command = Enums.Command('flagValues', 'Start');
    assert.equal(Command.FlagValues.name, 'FlagValues');
    assert.equal(Command.fromName('flagvalues'), Command.FlagValues);
    assert.equal(Command.flagValues, undefined);
    const Flags = Enums.Flags.flags('flagValues', 'Write');
    assert.equal(Flags.FlagValues.value, 1);
    assert.equal(Flags.flagValues, undefined);
    assert.equal(Flags.bitwise().combine([Flags.FlagValues, Flags.Write]).mask, 3);
});

test('combinations stay with their enum and do not mutate', () => {
    const Command = Enums.Command(['Start', 'Continue', 'Stop']);
    const flags = Command.bitwise();
    const original = flags.combine([Command.Start, Command.Stop]);
    const added = flags.add(original, [Command.Continue]);
    assert.equal(original.mask, 5);
    assert.deepEqual(flags.membersOf(original), [Command.Start, Command.Stop]);
    assert.equal(added.toString(), 'Start, Continue, Stop');
    assert.equal(original.toString(), 'Start, Stop');
    assert.equal(flags.parse('start, stop').equals(original), true);
    assert.deepEqual(JSON.parse(JSON.stringify(original)), ['Start', 'Stop']);
    assert.equal(flags.fromJSON(JSON.stringify(original)).equals(original), true);
    assert.equal(flags.fromJSON(['Start', 'Stop']).equals(original), true);
    assert.equal(flags.fromMask(original.mask).equals(original), true);
    assert.equal(Enums.bitwise.fromMask(Command, 5).equals(original), true);
    assert.throws(() => flags.fromMask(8), /Invalid Command mask/);
    assert.throws(() => flags.fromMask(-1), /Invalid Command mask/);
    assert.throws(() => flags.fromMask(5n), /Invalid Command mask/);
    assert.equal(Enums.bitwise.fromJSON(Command, ['Start', 'Stop']).equals(original), true);
    assert.throws(() => flags.fromJSON(['Start', 'Start']), /Duplicate/);
    assert.throws(() => flags.fromJSON(['Unknown']), /Unknown/);
    assert.throws(() => flags.fromJSON({ Start: true }), TypeError);
    assert.equal(flags.has(original, Command.Start), true);
    assert.equal(flags.has(original, Command.Continue), false);
    assert.equal(flags.remove(original, [Command.Start]).mask, 4);
    assert.equal(Enums.bitwise.combine(Command, [Command.Start, Command.Stop]).equals(original), true);

    const Other = Enums.Other(['Start']);
    assert.throws(() => Enums.bitwise.membersOf(Other, original), TypeError);
    assert.throws(() => flags.has(original, Other.Start), TypeError);
    assert.equal(Command.has, undefined);
});

test('match requires one handler for every member', () => {
    const Status = Enums.Status('Active', 'Pending', 'Done');
    const handlers = {
        Active: member => `${member.name}: ready`,
        Pending: () => 'waiting',
        Done: () => 'finished'
    };
    assert.equal(Status.match(Status.Active, handlers), 'Active: ready');
    assert.throws(() => Status.match(Status.Active, { Active: () => 'ready' }), /Missing: Pending, Done/);
    assert.throws(() => Status.match(Status.Done, { ...handlers, Don: () => 'typo' }), /Unknown: Don/);
    assert.throws(() => Status.match(Status.Active, { ...handlers, Done: 'finished' }), /must be a function/);
    const Other = Enums.Other('Active');
    assert.throws(() => Status.match(Other.Active, handlers), /Expected a Status member/);
});

test('parsing errors list valid names', () => {
    const Command = Enums.Command(['Start', 'Stop']);
    assert.throws(() => Command.parse('Strat'), /Valid names: Start, Stop/);
    assert.equal(Command.tryParse('Start'), Command.Start);
    assert.equal(Command.tryParse('Strat'), null);
    const out = {};
    assert.equal(Command.tryParse('stop', out), true);
    assert.equal(out.value, Command.Stop);
    assert.equal(Command.tryParse('Strat', out), false);
    assert.equal(out.value, null);
    assert.throws(() => Command.tryParse('Start', null), TypeError);
    assert.deepEqual([...Command], [Command.Start, Command.Stop]);
});

test('definition errors identify the conflicting entry', () => {
    assert.throws(() => Enums.Bad({ First: 1, Second: 1 }), /member "Second": duplicate value 1 \(already used by First\)/);
    assert.throws(() => Enums.Bad([{ Name: 'First', Aliases: ['second'] }, { Name: 'Second' }]), /Member Second: alias or name Second conflicts with First/);
    assert.throws(() => Enums.Bad([{ Name: 'First' }, {}]), /Entry 2: missing Name/);
});

test('strict declaration scope catches misspelled enum names', () => {
    const declarations = Enums.only(['APICommand', 'Status']);
    const Command = declarations.APICommand('Start', 'Stop');
    assert.equal(Command.Start.name, 'Start');
    assert.throws(() => declarations.APICmmand('Start'), /Enum APICmmand is not allowed/);
    assert.throws(() => Enums.only(['APICommand', 'APICommand']), /Duplicate allowed enum name/);
});

test('explicit flag values remain available', () => {
    const Permission = Enums.Permission.flags(['read', 'write', 'delete']);
    assert.equal(Permission.Delete.value, 4);
    assert.equal(Enums.bitwise.combine(Permission, [Permission.Read, Permission.Delete]).mask, 5);
    const Explicit = Enums.Explicit.flags([{ Name: 'Read', Value: 1 }, { Name: 'Write', Value: 8 }]);
    assert.equal(Explicit.Write.value, 8);
    assert.equal(Enums.bitwise.combine(Explicit, [Explicit.Read, Explicit.Write]).mask, 9);
    assert.throws(() => Enums.Bad.flags({ Read: 3 }), /one unique bit/);
});

test('case-sensitive lookup and portable definitions round trip', () => {
    const Status = Enums.Status([{ Name: 'Active', Aliases: ['Ready'], Label: 'On' }], { caseSensitive: true });
    assert.equal(Status.fromName('Active'), Status.Active);
    assert.equal(Status.fromName('active'), null);
    assert.equal(Status.fromName('Ready'), Status.Active);
    assert.equal(Status.fromName('ready'), null);
    const restored = Enums.fromJson(JSON.stringify(Status.toDefinition()));
    assert.equal(restored.fromName('Active').label, 'On');
    assert.equal(restored.fromName('active'), null);
    const Flag = Enums.Flag.flags(Array.from({ length: 40 }, (_, index) => `Item${index}`));
    const flagRestored = Enums.fromJson(JSON.stringify(Flag.toDefinition()));
    assert.equal(flagRestored.Item39.value, 1n << 39n);
    assert.equal(flagRestored.bitwise().fromMask(1n << 39n).toString(), 'Item39');
});

