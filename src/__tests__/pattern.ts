import Joi from 'joi';

import { convertSchema } from '../index';

describe('test `Joi.object().pattern()`', () => {
  test('`interface pattern()`', () => {
    const schema = Joi.object({
      nested: Joi.object({
        nestedName: Joi.string()
      }).pattern(Joi.string, Joi.object({
        nestedRecordProperty: Joi.string()
      }))
    })
      .label('TestSchema')
      .description('a test schema definition')
      .pattern(Joi.string, Joi.object({
        recordProperty: Joi.string(),
        recordOptionalProperty: Joi.string().optional(),
      }))
      .pattern(Joi.string, Joi.object({
        recordProperty: Joi.string(),
        recordOptionalProperty: Joi.string().optional(),
      }));

    const result = convertSchema({ sortPropertiesByName: false }, schema);
    expect(result).not.toBeUndefined;

    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  name?: string;
  nested: {
    nestedName: string,
    [x: string]: {
    nestedRecordProperty: string
    }
  },

  /**
   * Unknown Property
   */
  [x: string]: {
    recordProperty: string,
    recordOptionalProperty?: string
  }
}`);
  });
});
