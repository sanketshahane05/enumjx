// Enum members are singletons: Status.fromName('active') === Status.Active.
const registries = new WeakMap();
const boundBitwise = new WeakMap();
const memberToken = Symbol('enum member');
const combinationToken = Symbol('enum combination');

function freezeData(input, seen = new WeakSet()) {
    if (input === null || ['string', 'number', 'boolean'].includes(typeof input)) return input;
    if (typeof input !== 'object' || seen.has(input)) throw new TypeError('Data must be a non-cyclic JSON-like object');
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
        throw new TypeError('Data must contain only plain objects and arrays');
    }
    seen.add(input);
    const copy = Array.isArray(input) ? input.map(value => freezeData(value, seen)) : Object.create(null);
    if (!Array.isArray(input)) {
        for (const [key, value] of Object.entries(input)) copy[key] = freezeData(value, seen);
    }
    seen.delete(input);
    return Object.freeze(copy);
}

class EnumCombination {
    #enumClass;
    #mask;

    constructor(enumClass, mask, token) {
        if (token !== combinationToken) throw new TypeError('Use an enum to create combinations');
        this.#enumClass = enumClass;
        this.#mask = validateMask(enumClass, mask);
        Object.freeze(this);
    }

    get mask() { return this.#mask; }
    equals(other) { return other instanceof EnumCombination && other.#enumClass === this.#enumClass && other.#mask === this.#mask; }
    toString() { return bitwise.format(this.#enumClass, this); }
    toJSON() { return bitwise.membersOf(this.#enumClass, this).map(member => member.name); }
    belongsTo(enumClass) { return this.#enumClass === enumClass; }
}

class Enums {
    constructor(name, value, extra = {}, token) {
        if (token !== memberToken) throw new TypeError('Enum members can only be created from definitions');
        this.name = this.constructor.toUp(name);
        this.value = value;
        this.description = extra.description ?? null;
        this.label = extra.label ?? null;
        this.aliases = Object.freeze([...(extra.aliases ?? [])]);
        this.data = freezeData(extra.data ?? {});
        this.deprecation = extra.deprecation ?? null;
        this.deprecatedAliases = Object.freeze([...(extra.deprecatedAliases ?? [])]);
        Object.freeze(this);
    }

    static jsonMode = 'object'; // 'object', 'name', 'value', or 'both'
    static bitwise() {
        requireEnum(this);
        if (!boundBitwise.has(this)) {
            const enumClass = this;
            boundBitwise.set(this, Object.freeze({
                combine: (members = []) => bitwise.combine(enumClass, members),
                has: (combination, member) => bitwise.has(enumClass, combination, member),
                add: (combination, members) => bitwise.add(enumClass, combination, members),
                remove: (combination, members) => bitwise.remove(enumClass, combination, members),
                toggle: (combination, members) => bitwise.toggle(enumClass, combination, members),
                membersOf: combination => bitwise.membersOf(enumClass, combination),
                format: combination => bitwise.format(enumClass, combination),
                parse: text => bitwise.parse(enumClass, text),
                fromMask: mask => bitwise.fromMask(enumClass, mask),
                fromJSON: input => bitwise.fromJSON(enumClass, input)
            }));
        }
        return boundBitwise.get(this);
    }

    static toUp(str) {
        if (typeof str !== 'string') return str;
        str = str.trim();
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static lookupKey(str) { return str.trim().toLowerCase(); }

    static toDefinition() {
        requireEnum(this);
        const registry = registries.get(this);
        return {
            name: this.name,
            members: registry.members.map(member => ({
                Name: member.name,
                Value: typeof member.value === 'bigint' ? `${member.value}n` : member.value,
                Description: member.description,
                Label: member.label,
                Aliases: [...member.aliases],
                Data: member.data,
                Deprecation: member.deprecation,
                DeprecatedAliases: [...member.deprecatedAliases]
            })),
            flags: registry.flagValues,
            jsonMode: this.jsonMode,
            caseSensitive: registry.caseSensitive
        };
    }

    toString() { return this.name; }
    valueOf() { return this.value; }
    [Symbol.toPrimitive](hint) { return hint === 'string' ? this.name : this.value; }
    toJSON() {
        const mode = this.constructor.jsonMode;
        const bigValue = typeof this.value === 'bigint';
        const value = bigValue ? `${this.value}n` : this.value;
        if (mode === 'value') return value;
        if (mode === 'both') return bigValue ? { name: this.name, value, valueType: 'bigint' } : { name: this.name, value };
        if (mode === 'name') return this.name;
        return {
            name: this.name,
            value,
            ...(bigValue ? { valueType: 'bigint' } : {}),
            description: this.description,
            label: this.label,
            aliases: [...this.aliases],
            data: this.data,
            deprecation: this.deprecation,
            deprecatedAliases: [...this.deprecatedAliases]
        };
    }

    static fromName(name, def = null) {
        if (typeof name !== 'string') return def;
        return registries.get(this)?.byName.get(this.lookupKey(name)) ?? def;
    }

    static lookup(name) {
        if (typeof name !== 'string') return null;
        const entry = registries.get(this)?.byLookup.get(this.lookupKey(name));
        return entry ? { ...entry } : null;
    }

    static fromValue(value, def = null) {
        return registries.get(this)?.byValue.get(value) ?? def;
    }

    static from(input, def = null) {
        if (input instanceof this && this.values().includes(input)) return input;
        if (typeof input === 'string') return this.fromName(input) ?? this.fromValue(input, def);
        return this.fromValue(input, def);
    }

    static fromJSON(input, def = null) {
        if (this === Enums || this === EnumFactory) {
            return arguments.length === 1 ? this.fromJson(input) : this.fromJson(input, def);
        }
        if (input && typeof input === 'object' && !Array.isArray(input) && 'name' in input && 'value' in input) {
            const member = this.fromName(input.name);
            const value = input.valueType === 'bigint' && typeof input.value === 'string' && /^\d+n$/.test(input.value)
                ? BigInt(input.value.slice(0, -1)) : input.value;
            return member && Object.is(member.value, value) ? member : def;
        }
        if (typeof input === 'string' && /^\d+n$/.test(input)) return this.fromValue(BigInt(input.slice(0, -1)), def);
        return this.from(input, def);
    }

    static fromJson(input, enumName) {
        if (this !== Enums && this !== EnumFactory) return this.fromJSON(input, enumName);
        const source = parseDefinitionJSON(input);
        if (source && typeof source === 'object' && !Array.isArray(source) && typeof source.name === 'string' && Object.hasOwn(source, 'members')) {
            if (enumName !== undefined && enumName !== source.name) throw new Error('Conflicting enum names');
            return buildEnum(normalizeDefinitions(source.members), source.name, { jsonMode: source.jsonMode, flags: source.flags, caseSensitive: source.caseSensitive });
        }
        if (enumName === undefined) throw new TypeError('Provide an enum name or a JSON object with name and members');
        return buildEnum(normalizeDefinitions(source), enumName);
    }

    static define(enumName, ...sources) {
        if (this !== Enums && this !== EnumFactory) throw new TypeError('Call define on Enums');
        if (sources.length === 0) throw new TypeError('At least one member definition is required');
        const options = extractOptions(sources);
        const source = sources.length === 1 ? sources[0] : sources;
        return buildEnum(normalizeDefinitions(source), enumName, options);
    }

    static defineFlags(enumName, ...sources) {
        if (this !== Enums && this !== EnumFactory) throw new TypeError('Call defineFlags on Enums');
        if (sources.length === 0) throw new TypeError('At least one member definition is required');
        const options = extractOptions(sources);
        const source = sources.length === 1 ? sources[0] : sources;
        return buildEnum(normalizeDefinitions(source), enumName, { ...options, flags: true });
    }

    static parse(input) {
        const member = this.from(input);
        if (!member) throw new RangeError(`Unknown ${this.name} member: ${String(input)}. Valid names: ${this.names().join(', ')}`);
        return member;
    }

    static tryParse(input, out) {
        const member = this.from(input);
        if (arguments.length === 1) return member;
        if (!out || typeof out !== 'object' || Array.isArray(out)) {
            throw new TypeError('Output must be an object');
        }
        out.value = member;
        return member !== null;
    }

    static *[Symbol.iterator]() { yield* this.values(); }

    static only(names) {
        if (this !== Enums && this !== EnumFactory) throw new TypeError('Call only on Enums');
        if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !/^[A-Z][A-Za-z0-9_$]*$/.test(name))) {
            throw new TypeError('Allowed enum names must be an array of capitalized identifiers');
        }
        const allowed = new Set(names);
        if (allowed.size !== names.length) throw new Error('Duplicate allowed enum name');
        return new Proxy(Object.create(null), {
            get(_target, property) {
                if (typeof property !== 'string' || !/^[A-Z]/.test(property)) return undefined;
                if (!allowed.has(property)) throw new ReferenceError(`Enum ${property} is not allowed. Allowed: ${names.join(', ')}`);
                return declarationFor(property);
            }
        });
    }

    static isValid(input) { return this.from(input) !== null; }
    static hasName(name) { return this.fromName(name) !== null; }
    static hasValue(value) { return this.fromValue(value) !== null; }
    static toString(value) { return this.fromValue(value)?.name ?? 'Invalid'; }
    static values() { return [...(registries.get(this)?.members ?? [])]; }
    static names() { return this.values().map(member => member.name); }
    static entries() { return this.values().map(member => [member.name, member]); }

    static match(member, handlers) {
        const members = this.values();
        if (!members.includes(member)) throw new TypeError(`Expected a ${this.name} member`);
        if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) {
            throw new TypeError('Handlers must be an object');
        }
        const expected = new Set(members.map(item => item.name));
        const supplied = Object.keys(handlers);
        const missing = [...expected].filter(name => !Object.hasOwn(handlers, name));
        const extra = supplied.filter(name => !expected.has(name));
        if (missing.length || extra.length) {
            throw new RangeError(`Invalid ${this.name} match handlers. Missing: ${missing.join(', ') || 'none'}. Unknown: ${extra.join(', ') || 'none'}`);
        }
        for (const name of supplied) {
            if (typeof handlers[name] !== 'function') throw new TypeError(`Handler for ${name} must be a function`);
        }
        return handlers[member.name](member);
    }

    static initialize(defs, config = {}) {
        if (registries.has(this)) throw new Error(`${this.name} is already initialized`);
        if (defs === null || typeof defs !== 'object' || (!Array.isArray(defs) && Object.getPrototypeOf(defs) !== Object.prototype && Object.getPrototypeOf(defs) !== null)) {
            throw new TypeError('Definitions must be an array or a plain object');
        }
        if (!['object', 'name', 'value', 'both'].includes(this.jsonMode)) throw new TypeError('Invalid jsonMode');

        const members = [];
        const byName = new Map();
        const byLookup = new Map();
        const byValue = new Map();
        let nextValue = 1;
        const definitions = Array.isArray(defs) ? defs.map(name => [name, {}]) : Object.entries(defs);

        for (const [position, [rawName, definition]] of definitions.entries()) {
            const location = Array.isArray(defs) ? `entry ${position + 1}` : `member ${JSON.stringify(rawName)}`;
            const name = this.toUp(rawName);
            if (typeof name !== 'string' || !name || !/^[A-Za-z_$][\w$]*$/.test(name)) {
                throw new TypeError(`${location}: invalid enum member name ${JSON.stringify(rawName)}`);
            }
            const previous = members.find(member => this.lookupKey(member.name) === this.lookupKey(name));
            if (name in this || previous) {
                throw new Error(`${location}: ${previous ? `duplicate name ${name} (already used by ${previous.name})` : `reserved name ${name}`}`);
            }
            const options = Array.isArray(defs) ? {} : definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : { value: definition };
            const value = Object.hasOwn(options, 'value') ? options.value : nextValue;
            if ((!['string', 'number', 'boolean'].includes(typeof value) && !(config.flags === true && typeof value === 'bigint')) || (typeof value === 'number' && !Number.isFinite(value))) {
                throw new TypeError(`${location}: invalid value; expected a string, finite number, or boolean`);
            }
            if (byValue.has(value)) throw new Error(`${location}: duplicate value ${String(value)} (already used by ${byValue.get(value).name})`);
            if (options.aliases != null && (!Array.isArray(options.aliases) || options.aliases.some(alias => typeof alias !== 'string'))) {
                throw new TypeError(`${location}: aliases must be an array of strings`);
            }
            if (options.deprecatedAliases != null && (!Array.isArray(options.deprecatedAliases) || options.deprecatedAliases.some(alias => typeof alias !== 'string'))) {
                throw new TypeError(`${location}: deprecatedAliases must be an array of strings`);
            }
            if (options.deprecation != null && typeof options.deprecation !== 'string' && options.deprecation !== true) {
                throw new TypeError(`${location}: deprecation must be true or a message string`);
            }
            const aliases = (options.aliases ?? []).map(alias => this.toUp(alias));
            const deprecatedAliases = (options.deprecatedAliases ?? []).map(alias => this.toUp(alias));
            if (aliases.some(alias => !alias)) throw new TypeError(`${location}: empty alias`);
            if (deprecatedAliases.some(alias => !alias)) throw new TypeError(`${location}: empty deprecated alias`);
            const deprecation = options.deprecation === true ? 'Deprecated' : options.deprecation ?? null;
            const member = new this(name, value, { ...options, aliases, deprecatedAliases, deprecation }, memberToken);
            members.push(member);
            byValue.set(value, member);
            if (typeof value === 'number') nextValue = value + 1;
        }

        for (const member of members) {
            for (const [key, matchedBy] of [
                [member.name, 'name'],
                ...member.aliases.map(alias => [alias, 'alias']),
                ...member.deprecatedAliases.map(alias => [alias, 'deprecatedAlias'])
            ]) {
                const normalizedKey = this.lookupKey(key);
                if (byName.has(normalizedKey) && (byName.get(normalizedKey) !== member || byLookup.get(normalizedKey).matchedBy !== matchedBy)) {
                    throw new Error(`Member ${member.name}: alias or name ${key} conflicts with ${byName.get(normalizedKey).name}`);
                }
                byName.set(normalizedKey, member);
                byLookup.set(normalizedKey, {
                    member,
                    matchedBy,
                    deprecated: matchedBy === 'deprecatedAlias' || member.deprecation !== null,
                    message: matchedBy === 'deprecatedAlias' ? `Name ${key} is deprecated; use ${member.name}` : member.deprecation
                });
            }
        }
        for (const member of members) {
            Object.defineProperty(this, member.name, { value: member, enumerable: true });
        }
        registries.set(this, { members: Object.freeze(members), byName, byLookup, byValue, flagValues: config.flags === true, caseSensitive: config.caseSensitive === true, bigMask: members.length > 31 });
        Object.freeze(this.prototype);
        Object.freeze(this);
        return this;
    }

    static printTable() {
        console.table(this.values().map(member => ({
            Name: member.name, Value: member.value, Description: member.description,
            Label: member.label, Aliases: member.aliases.join(', ')
        })));
    }
}

function requireEnum(enumClass) {
    if (typeof enumClass !== 'function' || !registries.has(enumClass)) {
        throw new TypeError('Expected a defined enum class');
    }
    return enumClass;
}

function flagBit(enumClass, member) {
    const index = enumClass.values().indexOf(member);
    if (index < 0) throw new TypeError(`Expected a ${enumClass.name} member`);
    const registry = registries.get(enumClass);
    if (registry.flagValues) return registry.bigMask ? BigInt(member.value) : member.value;
    return registry.bigMask ? 1n << BigInt(index) : 2 ** index;
}

function validateMask(enumClass, mask) {
    requireEnum(enumClass);
    const members = enumClass.values();
    const big = registries.get(enumClass).bigMask;
    const zero = big ? 0n : 0;
    const allowed = members.reduce((bits, member) => bits | flagBit(enumClass, member), zero);
    if ((big ? typeof mask !== 'bigint' || mask < 0n : !Number.isInteger(mask) || mask < 0) || (mask & ~allowed) !== zero) {
        throw new RangeError(`Invalid ${enumClass.name} mask: ${String(mask)}`);
    }
    return mask;
}

function maskOf(enumClass, combination) {
    requireEnum(enumClass);
    if (!(combination instanceof EnumCombination) || !combination.belongsTo(enumClass)) {
        throw new TypeError(`Expected a ${enumClass.name} combination`);
    }
    return combination.mask;
}

function bitsFor(enumClass, members) {
    if (!Array.isArray(members)) throw new TypeError('Members must be an array');
    const zero = registries.get(enumClass).bigMask ? 0n : 0;
    return members.reduce((bits, member) => bits | flagBit(enumClass, member), zero);
}

const bitwise = Object.freeze({
    combine(enumClass, members = []) {
        requireEnum(enumClass);
        return new EnumCombination(enumClass, bitsFor(enumClass, members), combinationToken);
    },
    has(enumClass, combination, member) {
        const bit = flagBit(enumClass, member);
        return (maskOf(enumClass, combination) & bit) === bit;
    },
    add(enumClass, combination, members) {
        return new EnumCombination(enumClass, maskOf(enumClass, combination) | bitsFor(enumClass, members), combinationToken);
    },
    remove(enumClass, combination, members) {
        return new EnumCombination(enumClass, maskOf(enumClass, combination) & ~bitsFor(enumClass, members), combinationToken);
    },
    toggle(enumClass, combination, members) {
        return new EnumCombination(enumClass, maskOf(enumClass, combination) ^ bitsFor(enumClass, members), combinationToken);
    },
    membersOf(enumClass, combination) {
        const mask = maskOf(enumClass, combination);
        return enumClass.values().filter(member => {
            const bit = flagBit(enumClass, member);
            return (mask & bit) === bit;
        });
    },
    format(enumClass, combination) {
        return this.membersOf(enumClass, combination).map(member => member.name).join(', ');
    },
    parse(enumClass, text) {
        requireEnum(enumClass);
        if (typeof text !== 'string') throw new TypeError('Expected a comma-separated string');
        if (!text.trim()) return this.combine(enumClass);
        return this.combine(enumClass, text.split(',').map(name => enumClass.parse(name.trim())));
    },
    fromMask(enumClass, mask) {
        return new EnumCombination(enumClass, mask, combinationToken);
    },
    fromJSON(enumClass, input) {
        requireEnum(enumClass);
        const names = typeof input === 'string' ? JSON.parse(input) : input;
        if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) {
            throw new TypeError('Combination JSON must be an array of member names');
        }
        const members = names.map(name => enumClass.fromName(name));
        if (members.some(member => member == null)) throw new RangeError(`Unknown ${enumClass.name} member in combination JSON`);
        if (new Set(members).size !== members.length) throw new RangeError('Duplicate member in combination JSON');
        return this.combine(enumClass, members);
    }
});

function parseDefinitionJSON(input) {
    if (typeof input !== 'string') return input;
    try {
        return JSON.parse(input);
    } catch (error) {
        throw new SyntaxError(`Invalid enum JSON: ${error.message}`);
    }
}

function normalizeDefinitions(source) {
    if (typeof source === 'string') {
        const text = source.trim();
        if (text.startsWith('[') || text.startsWith('{') || text.startsWith('"')) {
            return normalizeDefinitions(parseDefinitionJSON(text));
        }
        return [source];
    }
    if (Array.isArray(source)) {
        if (source.every(item => typeof item === 'string')) return source;
        const definitions = Object.create(null);
        const seen = new Map();
        for (const [index, item] of source.entries()) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw new TypeError(`Entry ${index + 1}: expected a member object`);
            }
            const name = item.Name ?? item.name;
            if (typeof name !== 'string' || !name.trim()) throw new TypeError(`Entry ${index + 1}: missing Name`);
            const key = Enums.lookupKey(name);
            if (seen.has(key)) throw new Error(`Entry ${index + 1}: duplicate name ${name} (first used in entry ${seen.get(key)})`);
            seen.set(key, index + 1);
            const definition = {};
            for (const field of ['value', 'description', 'label', 'aliases', 'data', 'deprecation', 'deprecatedAliases']) {
                const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
                if (Object.hasOwn(item, field) || Object.hasOwn(item, capitalized)) {
                    definition[field] = item[field] ?? item[capitalized];
                }
            }
            definitions[name] = definition;
        }
        return definitions;
    }
    if (source && typeof source === 'object') return source;
    throw new TypeError('Definitions must be names, an array, an object, or JSON containing one');
}

function extractOptions(sources) {
    if (sources.length < 2) return {};
    const last = sources.at(-1);
    if (last && typeof last === 'object' && !Array.isArray(last) && Object.keys(last).length > 0 && Object.keys(last).every(key => key === 'jsonMode' || key === 'caseSensitive')) {
        sources.pop();
        return { ...last };
    }
    return {};
}

function buildEnum(defs, enumName, options = {}) {
    if (typeof enumName !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(enumName)) {
        throw new TypeError('enumName must be a valid JavaScript identifier');
    }
    if (options.flags !== undefined && typeof options.flags !== 'boolean') throw new TypeError('flags must be boolean');
    if (options.caseSensitive !== undefined && typeof options.caseSensitive !== 'boolean') throw new TypeError('caseSensitive must be boolean');
    if (options.flags) defs = makeFlagDefinitions(defs);
    const cls = { [enumName]: class extends Enums {} }[enumName];
    if (options.jsonMode !== undefined) cls.jsonMode = options.jsonMode;
    if (options.caseSensitive) cls.lookupKey = str => str.trim();
    return cls.initialize(defs, options);
}

function makeFlagDefinitions(defs) {
    const count = Array.isArray(defs) ? defs.length : Object.keys(defs).length;
    if (count > 64) throw new RangeError('Flag enums support at most 64 members');
    const big = count > 31;
    const entries = Array.isArray(defs)
        ? defs.map((name, index) => [name, { value: big ? 1n << BigInt(index) : 2 ** index }])
        : Object.entries(defs).map(([name, definition], index) => {
            const options = definition && typeof definition === 'object' && !Array.isArray(definition) ? { ...definition } : { value: definition };
            if (!Object.hasOwn(options, 'value')) options.value = big ? 1n << BigInt(index) : 2 ** index;
            return [name, options];
        });
    const seenNames = new Map();
    const seenValues = new Map();
    for (const [index, [name, definition]] of entries.entries()) {
        const normalizedName = Enums.lookupKey(name);
        if (seenNames.has(normalizedName)) throw new Error(`Flag entry ${index + 1}: duplicate name ${name} (first used in entry ${seenNames.get(normalizedName)})`);
        seenNames.set(normalizedName, index + 1);
        const rawValue = typeof definition.value === 'string' && /^\d+n$/.test(definition.value)
            ? BigInt(definition.value.slice(0, -1)) : definition.value;
        if (typeof rawValue !== 'bigint' && (!Number.isSafeInteger(rawValue) || rawValue <= 0)) {
            throw new TypeError(`Flag entry ${index + 1} (${String(name)}): value must be a positive power of two`);
        }
        const bits = BigInt(rawValue);
        if (bits <= 0n || bits > (1n << 63n) || (bits & (bits - 1n)) !== 0n || (!big && bits > (1n << 30n))) {
            throw new TypeError(`Flag entry ${index + 1} (${String(name)}): value must have one unique bit within the supported range`);
        }
        definition.value = big ? bits : Number(bits);
        const value = definition.value;
        if (seenValues.has(value)) throw new Error(`Flag entry ${index + 1} (${String(name)}): duplicate value ${value} (first used by ${seenValues.get(value)})`);
        seenValues.set(value, name);
    }
    return Object.fromEntries(entries);
}

function declarationFor(name) {
    const declare = (...sources) => Enums.define(name, ...sources);
    declare.flags = (...sources) => Enums.defineFlags(name, ...sources);
    return declare;
}

const EnumFactory = new Proxy(Enums, {
    get(target, property, receiver) {
        if (property === 'bitwise') return bitwise;
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        if (typeof property === 'string' && /^[A-Z][A-Za-z0-9_$]*$/.test(property)) {
            return declarationFor(property);
        }
        return undefined;
    }
});

export { EnumFactory as Enums, EnumCombination };

