import { Enums, type EnumCombination } from './enums.js';

const declarations = Enums.only(['APICommand', 'Permission'] as const);
const APICommand = declarations.APICommand('Start', 'Stop');
const start = APICommand.Start;
const selected: EnumCombination = APICommand.bitwise().combine([start]);
APICommand.bitwise().has(selected, start);
APICommand.tryParse('stop', {});
for (const member of APICommand) member.name;

const Permission = declarations.Permission.flags([{ Name: 'Read', Value: 1 }, { Name: 'Write', Value: 2 }]);
Permission.bitwise().combine([Permission.Read, Permission.Write]);

// @ts-expect-error The strict declaration scope excludes misspelled enum names.
declarations.APICmmand('Start');

