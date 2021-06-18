import { filterMap, toStringLiteral } from './utils';
import {
  JsDoc,
  makeTypeContentChild,
  makeTypeContentRoot,
  Settings,
  TypeContent,
  TypeContentChild,
  TypeContentRoot
} from './types';
import {
  AlternativesDescribe,
  ArrayDescribe,
  BaseDescribe,
  BasicDescribe,
  Describe,
  ObjectDescribe,
  StringDescribe
} from 'joiDescribeTypes';

// see __tests__/joiTypes.ts for more information
export const supportedJoiTypes = ['array', 'object', 'alternatives', 'any', 'boolean', 'date', 'number', 'string'];

// Sometimes we know the type content will have name set
type TypeContentWithName = TypeContent & { name: string };

function getCommonDetails(details: Describe, settings: Settings): { label?: string; jsDoc: JsDoc; required: boolean } {
  const label = details.flags?.label?.replace(/\s/g, '');
  const description = details.flags?.description;
  const presence = details.flags?.presence;
  const example = details.examples?.[0];

  let required;
  if (presence === 'optional') {
    required = false;
  } else if (presence === 'required') {
    required = true;
  } else {
    required = settings.defaultToRequired;
  }
  return { label, jsDoc: { description, example }, required };
}

export function getAllCustomTypes(parsedSchema: TypeContent): string[] {
  if (parsedSchema.__isRoot) {
    return parsedSchema.children.flatMap(child => getAllCustomTypes(child));
  } else {
    return parsedSchema.customTypes || [];
  }
}

/**
 * Get all indent characters for this indent level
 * @param settings includes what the indent characters are
 * @param indentLevel how many indent levels
 */
function getIndentStr(settings: Settings, indentLevel: number): string {
  return settings.indentationChacters.repeat(indentLevel);
}

/**
 * Get Interface jsDoc
 */
function getDescriptionStr(settings: Settings, name: string, jsDoc?: JsDoc, indentLevel = 0): string {
  if (!settings.commentEverything && !jsDoc?.description && !jsDoc?.example) {
    return '';
  }

  const lines = ['/**'];

  if (settings.commentEverything || (jsDoc && jsDoc.description)) {
    lines.push(` * ${jsDoc?.description ?? name}`);
  }

  if (jsDoc?.example) {
    lines.push(` * @example ${jsDoc.example}`);
  }

  lines.push(' */');
  return lines.map(line => `${getIndentStr(settings, indentLevel)}${line}`).join('\n') + '\n';
}

function typeContentToTsHelper(
  settings: Settings,
  parsedSchema: TypeContent,
  indentLevel: number,
  doExport = false
): { tsContent: string; jsDoc?: JsDoc } {
  if (!parsedSchema.__isRoot) {
    return {
      tsContent: parsedSchema.content,
      jsDoc: parsedSchema.jsDoc
    };
  }

  const children = parsedSchema.children;
  if (doExport && !parsedSchema.name) {
    throw new Error(`Type ${JSON.stringify(parsedSchema)} needs a name to be exported`);
  }
  switch (parsedSchema.joinOperation) {
    case 'list': {
      const childrenContent = children.map(child => typeContentToTsHelper(settings, child, indentLevel));
      if (childrenContent.length > 1) {
        throw new Error('Multiple array item types not supported');
      }
      let content = childrenContent[0].tsContent;
      if (content.includes('|')) {
        // TODO: might need a better way to add the parens for union
        content = `(${content})`;
      }
      const arrayStr = `${content}[]`;
      if (doExport) {
        return {
          tsContent: `export type ${parsedSchema.name} = ${arrayStr};`,
          jsDoc: parsedSchema.jsDoc
        };
      }
      return { tsContent: arrayStr, jsDoc: parsedSchema.jsDoc };
    }
    case 'union': {
      const childrenContent = children.map(child => typeContentToTsHelper(settings, child, indentLevel).tsContent);
      const unionStr = childrenContent.join(' | ');
      if (doExport) {
        return { tsContent: `export type ${parsedSchema.name} = ${unionStr};`, jsDoc: parsedSchema.jsDoc };
      }
      return { tsContent: unionStr, jsDoc: parsedSchema.jsDoc };
    }
    case 'object': {
      if (!children.length && !doExport) {
        return { tsContent: 'object', jsDoc: parsedSchema.jsDoc };
      }

      // interface can have no properties {} if the joi object has none defined
      let objectStr = '{}';

      if (children.length !== 0) {
        const childrenContent = children.map(child => {
          const childInfo = typeContentToTsHelper(settings, child, indentLevel + 1, false);

          // forcing name to be defined here, might need a runtime check but it should be set if we are here
          const descriptionStr = getDescriptionStr(settings, child.name as string, childInfo.jsDoc, indentLevel);
          const optionalStr = child.required ? '' : '?';
          const indentString = getIndentStr(settings, indentLevel);
          return `${descriptionStr}${indentString}${child.name}${optionalStr}: ${childInfo.tsContent};`;
        });
        objectStr = `{\n${childrenContent.join('\n')}\n${getIndentStr(settings, indentLevel - 1)}}`;
      }
      if (doExport) {
        return {
          tsContent: `export interface ${parsedSchema.name} ${objectStr}`,
          jsDoc: parsedSchema.jsDoc
        };
      }
      return { tsContent: objectStr, jsDoc: parsedSchema.jsDoc };
    }
    default:
      throw new Error(`Unsupported join operation ${parsedSchema.joinOperation}`);
  }
}

export function typeContentToTs(settings: Settings, parsedSchema: TypeContent, doExport = false): string {
  const { tsContent, jsDoc } = typeContentToTsHelper(settings, parsedSchema, 1, doExport);
  // forcing name to be defined here, might need a runtime check but it should be set if we are here
  const descriptionStr = getDescriptionStr(settings, parsedSchema.name as string, jsDoc);
  return `${descriptionStr}${tsContent}`;
}

// TODO: will be issues with useLabels if a nested schema has a label but is not exported on its own

// TODO: will need to pass around ignoreLabels more
/**
 * Parses a joi schema into a TypeContent
 * @param details: the joi schema
 * @param Settings: settings used for parsing
 * @param useLabels if true and if a schema has a label we won't parse it and instead just reference the label in the outputted type
 * @param ignoreLabels a list a label to ignore if found. Sometimes nested joi schemas will inherit the parents label so we want to ignore that
 */
export function parseSchema(
  details: Describe,
  settings: Settings,
  useLabels = true,
  ignoreLabels: string[] = [],
  rootSchema?: boolean
): TypeContent | undefined {
  function parseHelper(): TypeContent | undefined {
    switch (details.type) {
      case 'array':
        return parseArray(details, settings);
      case 'string':
        return parseStringSchema(details, settings, rootSchema ?? false);
      case 'alternatives':
        return parseAlternatives(details, settings);
      case 'object':
        return parseObjects(details, settings);
      default:
        return parseBasicSchema(details, settings, rootSchema ?? false);
    }
  }

  const { label, jsDoc, required } = getCommonDetails(details, settings);
  if (label && useLabels && !ignoreLabels.includes(label)) {
    // skip parsing and just reference the label since we assumed we parsed the schema that the label references
    // TODO: do we want to use the labels description if we reference it?

    const child = makeTypeContentChild({ content: label, customTypes: [label], jsDoc, required });

    const allowedValues = createAllowTypes(details);
    if (allowedValues.length !== 0) {
      allowedValues.unshift(child);

      return makeTypeContentRoot({ joinOperation: 'union', name: '', children: allowedValues, jsDoc, required });
    }
    return child;
  }
  if (settings.debug && !supportedJoiTypes.includes(details.type)) {
    console.debug(`unsupported type: ${details.type}`);
    return undefined;
  }
  const parsedSchema = parseHelper();
  if (!parsedSchema) {
    return undefined;
  }
  parsedSchema.name = label;
  parsedSchema.jsDoc = jsDoc;
  parsedSchema.required = required;
  return parsedSchema;
}

function parseBasicSchema(details: BasicDescribe, settings: Settings, rootSchema: boolean): TypeContent | undefined {
  const { label: name, jsDoc } = getCommonDetails(details, settings);

  const joiType = details.type;
  let content = joiType as string;
  if (joiType === 'date') {
    content = 'Date';
  }
  const values = details.allow;

  // at least one value
  if (values && values.length !== 0) {
    const allowedValues = createAllowTypes(details);

    if (values[0] === null) {
      allowedValues.unshift(makeTypeContentChild({ content }));
    }
    return makeTypeContentRoot({ joinOperation: 'union', children: allowedValues, name, jsDoc });
  }

  if (rootSchema) {
    return makeTypeContentRoot({
      joinOperation: 'union',
      children: [makeTypeContentChild({ content, name, jsDoc })],
      name,
      jsDoc
    });
  } else {
    return makeTypeContentChild({ content, name, jsDoc });
  }
}

function createAllowTypes(details: BaseDescribe): TypeContent[] {
  const values = details.allow;

  // at least one value
  if (values && values.length !== 0) {
    const allowedValues = values.map((value: unknown) =>
      makeTypeContentChild({ content: typeof value === 'string' ? toStringLiteral(value) : `${value}` })
    );
    return allowedValues;
  }

  return [];
}

/**
 * `undefined` is not part of this list as that would make the field optional instead
 */
const stringAllowValues = [null, ''];

function parseStringSchema(details: StringDescribe, settings: Settings, rootSchema: boolean): TypeContent | undefined {
  const { label: name, jsDoc } = getCommonDetails(details, settings);
  const values = details.allow;

  // at least one value
  if (values && values.length !== 0) {
    if (values.length === 1 && values[0] === '') {
      // special case of empty string sometimes used in Joi to allow just empty string
    } else {
      const allowedValues = values.map(value =>
        stringAllowValues.includes(value) && value !== ''
          ? makeTypeContentChild({ content: `${value}` })
          : makeTypeContentChild({ content: toStringLiteral(value) })
      );

      if (values.filter(value => stringAllowValues.includes(value)).length == values.length) {
        allowedValues.unshift(makeTypeContentChild({ content: 'string' }));
      }
      return makeTypeContentRoot({ joinOperation: 'union', children: allowedValues, name, jsDoc });
    }
  }

  if (rootSchema) {
    return makeTypeContentRoot({
      joinOperation: 'union',
      children: [makeTypeContentChild({ content: 'string', name, jsDoc })],
      name,
      jsDoc
    });
  } else {
    return makeTypeContentChild({ content: 'string', name, jsDoc });
  }
}

function parseArray(details: ArrayDescribe, settings: Settings): TypeContent | undefined {
  // TODO: handle multiple things in the items arr
  const item = details.items ? details.items[0] : ({ type: 'any' } as Describe);
  const { label: name, jsDoc } = getCommonDetails(details, settings);

  const child = parseSchema(item, settings);
  if (!child) {
    return undefined;
  }

  const allowedValues = createAllowTypes(details);
  // at least one value
  if (allowedValues.length !== 0) {
    allowedValues.unshift(makeTypeContentRoot({ joinOperation: 'list', children: [child], name, jsDoc }));

    return makeTypeContentRoot({ joinOperation: 'union', children: allowedValues, name, jsDoc });
  }

  return makeTypeContentRoot({ joinOperation: 'list', children: [child], name, jsDoc });
}

function parseAlternatives(details: AlternativesDescribe, settings: Settings): TypeContent | undefined {
  const { label, jsDoc } = getCommonDetails(details, settings);
  const ignoreLabels = label ? [label] : [];
  const children = filterMap(details.matches, match => {
    return parseSchema(match.schema, settings, true, ignoreLabels);
  });
  // This is an check that cannot be tested as Joi throws an error before this package
  // can be called, there is test for it in alternatives
  if (children.length === 0) {
    /* istanbul ignore next */
    return undefined;
  }

  return makeTypeContentRoot({ joinOperation: 'union', children, name: label, jsDoc });
}

function parseObjects(details: ObjectDescribe, settings: Settings): TypeContent | undefined {
  let children = filterMap(Object.entries(details.keys || {}), ([key, value]) => {
    const parsedSchema = parseSchema(value, settings);
    // The only type that could return this is alternatives
    // see parseAlternatives for why this is ignored
    if (!parsedSchema) {
      return undefined;
    }
    parsedSchema.name = /^[$A-Z_][0-9A-Z_$]*$/i.test(key || '') ? key : `'${key}'`;
    return parsedSchema as TypeContentWithName;
  });

  if (details?.patterns?.length === 1) {
    const type = details.patterns[0]?.schema?.type;

    // TypeScript index signatures must be either `string` or `number`
    if (['string', 'number'].includes(type)) {
      const isRecord = (parsedSchema: any): parsedSchema is TypeContentRoot =>
        parsedSchema?.name === undefined && Array.isArray(parsedSchema.children);
      const isCustomType = (parsedSchema: any): parsedSchema is TypeContentChild =>
        parsedSchema?.name === undefined && Array.isArray(parsedSchema.customTypes);

      const parsedPatternSchema = parseSchema(details?.patterns[0].rule, settings);

      let propertyChildren = [parsedPatternSchema];

      if (isRecord(parsedPatternSchema)) {
        propertyChildren = [...parsedPatternSchema?.children];
      }

      let recordProperty: TypeContentWithName;

      if (isCustomType(parsedPatternSchema)) {
        recordProperty = {
          content: parsedPatternSchema.content,
          customTypes: [parsedPatternSchema.content],
          name: `[x: ${type}]`,
          required: true
        } as TypeContentWithName;
      } else {
        recordProperty = {
          __isRoot: true,
          joinOperation: parsedPatternSchema?.joinOperation,
          name: `[x: ${type}]`,
          required: true,
          children: [...propertyChildren]
        } as TypeContentWithName;
      }

      children.push(recordProperty);
    }
  }

  if (details?.flags?.unknown === true) {
    const unknownProperty = {
      content: 'any',
      name: '[x: string]',
      required: true,
      jsDoc: { description: 'Unknown Property' }
    } as TypeContentWithName;
    children.push(unknownProperty);
  }

  if (settings.sortPropertiesByName) {
    children = children.sort((a, b) => {
      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      }
      // this next line can never happen as the object is totally invalid as the object is invalid
      // the code would not build so ignoring this
      /* istanbul ignore next */
      return 0;
    });
  }

  const { label: name, jsDoc } = getCommonDetails(details, settings);

  const allowedValues = createAllowTypes(details);

  // at least one value
  if (allowedValues.length !== 0) {
    allowedValues.unshift(makeTypeContentRoot({ joinOperation: 'object', children, name, jsDoc }));

    return makeTypeContentRoot({ joinOperation: 'union', children: allowedValues, name, jsDoc });
  }

  return makeTypeContentRoot({ joinOperation: 'object', children, name, jsDoc });
}
