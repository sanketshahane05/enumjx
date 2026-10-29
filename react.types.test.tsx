import { Enums, EnumSelect, EnumMultiSelect, EnumCombinationSelect } from 'enumjx';

const Role = Enums.Role([{ Name: 'Admin', Value: 'admin' }, { Name: 'User', Value: 'user' }]);
const selected = Role.bitwise().combine([Role.Admin]);

<EnumSelect enumType={Role} value={Role.Admin} onChange={member => { member?.name; }} />;
<EnumMultiSelect enumType={Role} value={[Role.Admin]} onChange={members => { members[0]?.name; }} />;
<EnumCombinationSelect enumType={Role} value={selected} onChange={combination => { combination.mask; }} />;

