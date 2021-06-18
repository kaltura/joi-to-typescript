import { existsSync, readFileSync, rmdirSync } from 'fs';
import Joi from 'joi';
import { convertFromDirectory, convertSchema, Settings } from '../..';

describe('test the use of .label()', () => {
  const typeOutputDirectory = './src/__tests__/label/interfaces';
  const schemaDirectory = './src/__tests__/label/schemas';

  // beforeEach(() => {
  //   rmdirSync(typeOutputDirectory, { recursive: true });
  // });

  test('generate label interfaces', async () => {
    const consoleSpy = jest.spyOn(console, 'debug');
    const result = await convertFromDirectory({
      schemaDirectory,
      typeOutputDirectory,
      debug: true
    });

    expect(result).toBe(true);

    expect(existsSync(`${typeOutputDirectory}/index.ts`)).toBeTruthy();

    expect(consoleSpy).toHaveBeenCalledWith(
      "It is recommended you update the Joi Schema 'nolabelSchema' similar to: nolabelSchema = Joi.object().label('nolabel')"
    );
  });

  test('no label', () => {
    const oneContent = readFileSync(`${typeOutputDirectory}/NoLabelTest.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export interface nolabeltest {
  name?: string;
}
`
    );
  });

  // it would be nice to auto remove this schema suffix but that could break the Joi, the safest is to warn the user about
  // how they could do it better
  test('no label with schema as suffix', () => {
    const oneContent = readFileSync(`${typeOutputDirectory}/NoLabel.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export interface nolabelSchema {
  name?: string;
}
`
    );
  });

  test('label', () => {
    const oneContent = readFileSync(`${typeOutputDirectory}/Label.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export interface Frank {
  name?: string;
}
`
    );
  });

  test('labeled property names', () => {
    const oneContent = readFileSync(`${typeOutputDirectory}/LabelProperty.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export type Name = string;

export interface label {
  name?: Name;
}
`
    );
  });

  test('labeled property names with spaces', () => {
    const oneContent = readFileSync(`${typeOutputDirectory}/LabelPropertySpaced.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export type CustomerPhoneNumber = string;

export type EmailAddress = string;

export type Name = string;

export interface spacedLabel {
  email?: EmailAddress;
  name?: Name;
  phone?: CustomerPhoneNumber;
}
`
    );
  });

  test('no label() and no property name', () => {
    expect(() => {
      convertSchema(
        {} as Settings,
        Joi.object({
          name: Joi.string().optional()
        })
      );
    }).toThrowError();
  });

  test('Joi.id() instead of Joi.label()', () => {
    const schema = Joi.object({
      name: Joi.string()
    }).id('Test');
    try {
      convertSchema({ debug: true }, schema);
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toBe(
        'At least one "object" does not have a .label(). Details: {"type":"object","flags":{"id":"Test"},"keys":{"name":{"type":"string"}}}'
      );
    }
  });

  test('no label with typeNameSuffix', async () => {
    if (existsSync(typeOutputDirectory)) {
      rmdirSync(typeOutputDirectory, { recursive: true });
    }

    await convertFromDirectory({
      schemaDirectory: './src/__tests__/label/schemas',
      typeOutputDirectory,
      typeNameSuffix: 'Schema'
    });

    const oneContent = readFileSync(`${typeOutputDirectory}/NoLabel.ts`).toString();

    expect(oneContent).toBe(
      `/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

export interface Nolabel {
  name?: string;
}
`
    );
  });
});
