// Copyright (C) 2022-2025 cooklang contributors, Subhajit Sahu
// SPDX-License-Identifier: AGPL-3.0-or-later
// See LICENSE for full terms

//#region COMMON TYPES
/** An ingredient with associated quantity and units. */
export interface Ingredient {
  /** Type of this object (ingredient). */
  type: 'ingredient';
  /** Name of the ingredient (e.g., thyme, chilli, ginger, etc.) */
  name: string;
  /** Quantity of the ingredient. */
  quantity: string | number;
  /** Associated units for the quantity (e.g. g, l, cup, items, etc.) */
  units: string;
  /** Preparation for the ingredient (e.g. peeled and finely chopped) */
  preparation?: string;
  /** Step number in which this ingredient is used */
  step?: number;
}


/** A piece of cookware, with needed quantity. */
export interface Cookware {
  /** Type of this object (cookware) */
  type: 'cookware';
  /** Name of the cookware (e.g., frying pan, pan, big cooking pot, etc.) */
  name: string;
  /** Quantity of the cookware needed */
  quantity: string | number;
  /** Step number in which this cookware is used */
  step?: number;
}


/** A timer, with duration (quantity and units). */
export interface Timer {
  /** Type of this object (timer) */
  type: 'timer';
  /** Name of the timer. */
  name?: string;
  /** Duration of the timer, without units. */
  quantity: string | number;
  /** Units of the timer (e.g., minutes, seconds, etc.) */
  units: string;
}


/** A piece of text. */
export interface Text {
  /** Type of this object (text) */
  type: 'text';
  /** The text content. */
  value: string;
}


/** A step consisting of multiple ingredients, cookware, timers, and text. */
export type Step = Array<Ingredient | Cookware | Timer | Text>;


/** A recipes metadata. */
export type Metadata = Record<string, string>;


/** A shopping list item. */
export interface Item {
  /** Name of the item. */
  name: string;
  /** Other names for the item, i.e., its synonym. */
  synonym?: string;
}


/** A shopping list consisting of categories and their items. */
export type ShoppingList = Record<string, Array<Item>>;
//#endregion




//#region TOKENS
const metadata = /^>>\s*(?<key>.+?):\s*(?<value>.+)/;

const multiwordIngredient = /@(?<mIngredientName>[^@#~[]+?)\{(?<mIngredientQuantity>[^]*?)(?:%(?<mIngredientUnits>[^}]+?))?\}(\((?<mIngredientPreparation>[^]*?)\))?/;
const singleWordIngredient = /@(?<sIngredientName>[^\s\t\p{Zs}\p{P}]+)/;

const multiwordCookware = /#(?<mCookwareName>[^@#~[]+?)\{(?<mCookwareQuantity>.*?)\}/;
const singleWordCookware = /#(?<sCookwareName>[^\s\t\p{Zs}\p{P}]+)/;

const timer = /~(?<timerName>.*?)(?:\{(?<timerQuantity>.*?)(?:%(?<timerUnits>.+?))?\})/;

export const comment = /--.*/g;
export const blockComment = /\s*\[\-[\s\S]*?\-\]\s*/g;

export const shoppingList = /\n\s*\[(?<name>.+)\]\n(?<items>[^]*?)(?:\n\n|$)/g;
export const tokens = new RegExp([metadata, multiwordIngredient, singleWordIngredient, multiwordCookware, singleWordCookware, timer].map(r => r.source).join('|'), 'gu');
//#endregion




//#region PARSER
/** Options for the parser. */
export interface ParserOptions {
  /** The default value to pass if there is no cookware amount [1]. */
  defaultCookwareAmount?: string | number;
  /** The default value to pass if there is no ingredient amount [some]. */
  defaultIngredientAmount?: string | number;
  /** Whether or not to include the step number in ingredient and cookware nodes. */
  includeStepNumber?: boolean;
}


/** The result of parsing a Cooklang recipe. */
export interface ParseResult {
  /** The parsed ingredients. */
  ingredients: Ingredient[];
  /** The parsed cookwares. */
  cookwares: Cookware[];
  /** The parsed metadata. */
  metadata: Metadata;
  /** The parsed steps. */
  steps: Step[];
  /** The parsed shopping list. */
  shoppingList: ShoppingList;
}


export class Parser {
  defaultCookwareAmount: string | number;
  defaultIngredientAmount: string | number;
  includeStepNumber: boolean;
  defaultUnits = '';

  /**
   * Create a new parser with the supplied options.
   * @param options parser's options
   */
  constructor(options?: ParserOptions) {
    this.defaultCookwareAmount   = options?.defaultCookwareAmount   ?? 1;
    this.defaultIngredientAmount = options?.defaultIngredientAmount ?? 'some';
    this.includeStepNumber       = options?.includeStepNumber       ?? false;
  }


  /**
   * Parse a Cooklang string and returns any metadata, steps, or shopping lists
   * @param source a Cooklang recipe
   * @returns extracted ingredients, cookwares, metadata, steps, and shopping lists
   */
  parse(source: string): ParseResult {
    const ingredients: Ingredient[] = [];
    const cookwares: Cookware[] = [];
    const metadata: Metadata = {};
    const steps: Step[] = [];
    const shoppingList: ShoppingList = {};
    source = source.replace(comment, '').replace(blockComment, ' ');
    // Parse shopping lists
    for (let match of source.matchAll(shoppingListRegex)) {
      const groups = match.groups;
      if (!groups) continue;
      shoppingList[groups.name] = parseShoppingListCategory(groups.items || '');
      source = source.substring(0, match.index || 0);
      +source.substring((match.index || 0) + match[0].length);
    }
    const lines = source.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let stepNumber = 0;
    stepLoop: for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const step: Step = [];
      let pos = 0;
      for (let match of line.matchAll(tokens)) {
        const groups = match.groups;
        if (!groups) continue;
        if (groups.key && groups.value) {
          metadata[groups.key.trim()] = groups.value.trim();
          continue stepLoop;
        }
        if (pos < (match.index || 0)) step.push({type: 'text', value: line.substring(pos, match.index)});
        // Single word ingredient
        if (groups.sIngredientName) {
          const ingredient: Ingredient = {
            type: 'ingredient',
            name: groups.sIngredientName,
            quantity: this.defaultIngredientAmount,
            units: this.defaultUnits,
          };
          if (this.includeStepNumber) ingredient.step = stepNumber;
          ingredients.push(ingredient);
          step.push(ingredient);
        }
        // Multiword ingredient
        if (groups.mIngredientName) {
          const ingredient: Ingredient = {
            type: 'ingredient',
            name: groups.mIngredientName,
            quantity: parseQuantity(groups.mIngredientQuantity) ?? this.defaultIngredientAmount,
            units: parseUnits(groups.mIngredientUnits) ?? this.defaultUnits,
            ...(groups.mIngredientPreparation ? { preparation: groups.mIngredientPreparation} : null),
          };
          if (this.includeStepNumber) ingredient.step = stepNumber;
          ingredients.push(ingredient);
          step.push(ingredient);
        }
        // Single word cookware
        if (groups.sCookwareName) {
          const cookware: Cookware = {
            type: 'cookware',
            name: groups.sCookwareName,
            quantity: this.defaultCookwareAmount,
          };
          if (this.includeStepNumber) cookware.step = stepNumber;
          cookwares.push(cookware);
          step.push(cookware);
        }
        // Multiword cookware
        if (groups.mCookwareName) {
          const cookware: Cookware = {
            type: 'cookware',
            name: groups.mCookwareName,
            quantity: parseQuantity(groups.mCookwareQuantity) ?? this.defaultCookwareAmount};
          if (this.includeStepNumber) cookware.step = stepNumber;
          cookwares.push(cookware);
          step.push(cookware);
        }
        // timer
        if (groups.timerQuantity) {
          step.push({
            type: 'timer',
            name: groups.timerName,
            quantity: parseQuantity(groups.timerQuantity) ?? 0,
            units: parseUnits(groups.timerUnits) ?? this.defaultUnits,
          });
        }
        pos = (match.index || 0) + match[0].length;
      }
      // If the entire line hasn't been parsed yet
      if (pos < line.length) {
        // Add the rest as a text item
        step.push({
          type: 'text',
          value: line.substring(pos),
        });
      }
      if (step.length > 0) {
        steps.push(step);
        stepNumber++;
      }
    }
    return {ingredients, cookwares, metadata, steps, shoppingList};
  }
}


function parseQuantity(quantity?: string): string | number | null {
  if (!quantity || quantity.trim() === '') return null;
  quantity = quantity.trim();
  const [left, right]       = quantity.split('/');
  const [numLeft, numRight] = [Number(left), Number(right)];
  if (right && isNaN(numRight))     return quantity;
  if (!isNaN(numLeft) && !numRight) return numLeft;
  else if (!isNaN(numLeft) && !isNaN(numRight) && !(left.startsWith('0') || right.startsWith('0'))) return numLeft / numRight;
  return quantity.trim();
}


function parseUnits(units?: string): string | null {
  if (!units || units.trim() === "") return null;
  return units.trim();
}


function parseShoppingListCategory(items: string): Item[] {
  const list: Item[] = [];
  for (let item of items.split('\n')) {
    item = item.trim();
    if (item == '') continue;
    const [name, synonym] = item.split('|');
    list.push({name: name.trim(), synonym: synonym?.trim() || ''})
  }
  return list;
}
//#endregion




//#region RECIPE
export default class Recipe {
  ingredients: Ingredient[] = [];
  cookwares: Cookware[] = [];
  metadata: Metadata = {};
  steps: Step[] = [];
  shoppingList: ShoppingList = {};

  private parser: Parser;

  /**
   * Create a new recipe from the supplied Cooklang string.
   * @param source Cooklang string to parse (can be omitted to create an empty recipe)
   * @param options options to pass to the parser
   */
  constructor(source?: string, options?: ParserOptions) {
    this.parser = new Parser(options);
    if (source) Object.assign(this, this.parser.parse(source));
  }


  /**
   * Generate a Cooklang string from the recipes metadata, steps, and shopping lists
   * @returns generated Cooklang string
   */
  toCooklang(): string {
    let metadataStr = '';
    let stepStrs = [];
    let shoppingListStrs = [];
    for (let [key, value] of Object.entries(this.metadata)) {
      metadataStr += `>> ${key}: ${value}\n`;
    }
    for (let step of this.steps) {
      let stepStr = '';
      for (let item of step) {
        if ('value' in item) {
          stepStr += item.value;
        }
        else {
          if (item.type == 'ingredient') stepStr += '@';
          else if (item.type == 'cookware') stepStr += '#';
          else stepStr += '~';
          stepStr += item.name;
          stepStr += '{';
          if (item.quantity) stepStr += item.quantity;
          if ('units' in item && item.units) stepStr += '%' + item.units;
          if ('preparation' in item && item.preparation) stepStr += `(${item.preparation})`
          stepStr += '}';
        }
      }
      stepStrs.push(stepStr);
    }
    for (let [category, items] of Object.entries(this.shoppingList)) {
      let shoppingListStr = '';
      shoppingListStr += category + '\n';
      shoppingListStr += items.map(x => x.name + (x.synonym ? '|' + x.synonym : '')).join('\n');
      shoppingListStrs.push(shoppingListStr);
    }
    return [metadataStr, stepStrs.join('\n\n'), shoppingListStrs.join('\n\n')].join('\n');
  }
}
//#endregion




//#region IMAGE URLS
export interface ImageURLOptions {
  step?: number;
  extension?: 'png' | 'jpg';
}


/**
 * Create a URL for an image of the supplied recipe.
 * @param name name of the .cook file
 * @param options URL options
 * @returns image URL for the givin recipe and step
 * @example
 * ```typescript
 * getImageURL('Baked Potato', { extension: 'jpg', step: 2 });
 * // returns "Baked Potato.2.jpg"
 * ```
 */
export function getImageURL(name: string, options?: ImageURLOptions) {
  options ??= {};
  return name + (options.step ? '.' + options.step : '') + '.' + (options.extension || 'png');
}
//#endregion
