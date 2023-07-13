import {
    CallExpression,
    FunctionExpression,
    Identifier,
    MemberExpression, NumericLiteral,
    ObjectExpression,
    ObjectProperty,
    StringLiteral
} from "@babel/types";

type KnownObjectProperty<TValue extends Pick<ObjectProperty, 'key' | 'value'>> = Omit<ObjectProperty, 'key' | 'value'> & TValue;
type KnownObjectExpression<TValue extends Pick<ObjectExpression, 'properties'>> = Omit<ObjectExpression, 'properties'> & TValue;
type ModuleMethodCall<
    MethodName extends ModuleMethodName,
    Arguments extends CallExpression['arguments']
> = Omit<CallExpression, 'callee' | 'arguments'> & {
    callee: MemberExpression & {
        object: Identifier;
        property: Omit<Identifier, 'name'> & { name: MethodName };
    }
    arguments: Arguments
}
/**
 * Meteor's `module.link()` method, exposed internally for built Meteor packages.
 *
 * @example
 * module.link('meteor/ostrio:cookies', {
 *     default: 'Cookies'
 * })
 * @example
 * module1.link("meteor/tracker", {
 *     "*": "*"
 * }, 1);
 */
type ModuleLink = ModuleMethodCall<'link', [
    importPath: StringLiteral,
    exports: ObjectExpression,
    id: NumericLiteral
] | [importPath: StringLiteral]>;

/**
 * Meteor's `module.exportDefault()` method - seems to only be used primarily for modules that are written in
 * TypeScript?
 * @example
 * function namedFunction() {
 *   return 'foo';
 * }
 * module1.exportDefault(namedFunction);
 */
type ModuleExportDefault = ModuleMethodCall<'exportDefault', [
    CallExpression['arguments'][number], // Can be anything, see ts_modules mock for example
]>

export type MeteorPackageProperty = KnownObjectProperty<{
    key: StringLiteral, // File name
    value: FunctionExpression | MeteorNestedPackageProperty, // Module function
}>
type MeteorNestedPackageProperty = KnownObjectExpression<{
    properties: MeteorPackageProperty[]
}>

export const KnownModuleMethodNames = ['export', 'link', 'exportDefault'] as const;
export type ModuleMethodName = typeof KnownModuleMethodNames[number];

export type PackageConfig = KnownObjectExpression<{
    properties: [KnownObjectProperty<{
        key: StringLiteral & { value: 'node_modules' }
        value: KnownObjectExpression<{
            properties: [KnownObjectProperty<{
                key: StringLiteral & { value: 'meteor' },
                value: KnownObjectExpression<{
                    properties: [KnownObjectProperty<{
                        key: StringLiteral, // Package name
                        value: KnownObjectExpression<{
                            properties: MeteorPackageProperty[]
                        }>
                    }>]
                }>
            }>]
        }>
    }>]
}>