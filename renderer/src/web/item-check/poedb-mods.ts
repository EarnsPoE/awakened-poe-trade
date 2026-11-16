import { ItemCategory } from '@/parser'
import type { ParsedItem } from '@/parser'
import type { BaseType } from '@/assets/data'

// PoEDB pages for an item class that have a "ModifiersCalc" section.
// Slugs verified against https://poedb.tw/us/Modifiers.
const CLASS_PAGES: Partial<Record<ItemCategory, string>> = {
  [ItemCategory.Amulet]: 'Amulets',
  [ItemCategory.Ring]: 'Rings',
  [ItemCategory.Belt]: 'Belts',
  [ItemCategory.Trinket]: 'Trinkets',
  [ItemCategory.Quiver]: 'Quivers',
  [ItemCategory.Claw]: 'Claws',
  [ItemCategory.Dagger]: 'Daggers',
  [ItemCategory.RuneDagger]: 'Rune_Daggers',
  [ItemCategory.Wand]: 'Wands',
  [ItemCategory.Sceptre]: 'Sceptres',
  [ItemCategory.OneHandedSword]: 'One_Hand_Swords',
  [ItemCategory.OneHandedAxe]: 'One_Hand_Axes',
  [ItemCategory.OneHandedMace]: 'One_Hand_Maces',
  [ItemCategory.Bow]: 'Bows',
  [ItemCategory.Staff]: 'Staves',
  [ItemCategory.Warstaff]: 'Warstaves',
  [ItemCategory.TwoHandedSword]: 'Two_Hand_Swords',
  [ItemCategory.TwoHandedAxe]: 'Two_Hand_Axes',
  [ItemCategory.TwoHandedMace]: 'Two_Hand_Maces',
  [ItemCategory.FishingRod]: 'Fishing_Rods',
  [ItemCategory.Tincture]: 'Tinctures',
  [ItemCategory.HeistContract]: 'Contracts',
  [ItemCategory.HeistBlueprint]: 'Blueprints'
}

// Armour classes are split on PoEDB by attribute, e.g. Body_Armours_str_dex.
const ARMOUR_PAGES: Partial<Record<ItemCategory, string>> = {
  [ItemCategory.Helmet]: 'Helmets',
  [ItemCategory.BodyArmour]: 'Body_Armours',
  [ItemCategory.Gloves]: 'Gloves',
  [ItemCategory.Boots]: 'Boots',
  [ItemCategory.Shield]: 'Shields'
}

// "Thrusting One Hand Swords" is its own item class in game and on PoEDB,
// but shares ItemCategory.OneHandedSword in this app.
const THRUSTING_SWORDS = new Set([
  'Rusted Spike', 'Whalebone Rapier', 'Battered Foil', 'Basket Rapier',
  'Jagged Foil', 'Antique Rapier', 'Elegant Foil', 'Thorn Rapier',
  'Smallsword', 'Wyrmbone Rapier', 'Burnished Foil', 'Estoc',
  'Serrated Foil', 'Primeval Rapier', 'Fancy Foil', 'Apex Rapier',
  'Courtesan Sword', 'Dragonbone Rapier', 'Tempered Foil', 'Pecoraro',
  'Spiraled Foil', 'Vaal Rapier', 'Jewelled Foil', 'Harpy Rapier',
  'Dragoon Sword'
])

export function poedbSlug (refName: string) {
  return encodeURIComponent(refName.replaceAll("'", '').replaceAll(' ', '_'))
}

function armourAttributes (base: BaseType): string | undefined {
  const attrs: string[] = []
  if (base.armour?.ar) attrs.push('str')
  if (base.armour?.ev) attrs.push('dex')
  if (base.armour?.es) attrs.push('int')
  return attrs.length ? attrs.join('_') : undefined
}

// Page (without language prefix) listing the modifiers that can roll
// on the item's class. Falls back to the base item's own page, which has
// the ModifiersCalc section for bases PoEDB treats as their own class
// (jewels, cluster jewels, ward armour, heist gear, charms, idols).
export function poedbModsPage (item: ParsedItem): string {
  const base = item.uniqueBase ?? item.info
  const category = item.category

  if (category === ItemCategory.OneHandedSword && THRUSTING_SWORDS.has(base.refName)) {
    return 'Thrusting_One_Hand_Swords#ModifiersCalc'
  }

  const classPage = category && CLASS_PAGES[category]
  if (classPage) return `${classPage}#ModifiersCalc`

  const armourPage = category && ARMOUR_PAGES[category]
  if (armourPage) {
    const attrs = armourAttributes(base)
    if (attrs && (attrs !== 'str_dex_int' || category === ItemCategory.BodyArmour)) {
      return `${armourPage}_${attrs}#ModifiersCalc`
    }
  }

  if (category === ItemCategory.Flask) {
    if (base.refName.endsWith('Life Flask')) return 'Life_Flasks#ModifiersCalc'
    if (base.refName.endsWith('Mana Flask')) return 'Mana_Flasks#ModifiersCalc'
    if (base.refName.endsWith('Hybrid Flask')) return 'Hybrid_Flasks'
    return 'Utility_Flasks#ModifiersCalc'
  }

  return `${poedbSlug(base.refName)}#ModifiersCalc`
}
