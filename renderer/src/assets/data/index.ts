import fnv1a from '@sindresorhus/fnv1a'
import type { BaseType, DropEntry, Stat, StatOrGroup, StatMatcher, TranslationDict } from './interfaces'

export * from './interfaces'

export let ITEM_DROP: DropEntry[]
export let CLIENT_STRINGS: TranslationDict
export let CLIENT_STRINGS_REF: TranslationDict
export let APP_PATRONS: Array<{ from: string, months: number, style: number }>

export let ITEM_BY_TRANSLATED: (ns: BaseType['namespace'], name: string) => BaseType[] | undefined = () => undefined
export let ITEM_BY_REF: (ns: BaseType['namespace'], name: string) => BaseType[] | undefined = () => undefined
export let ITEMS_ITERATOR: (includes: string, andIncludes?: string[]) => Generator<BaseType> = function * () {}

export let ALTQ_GEM_NAMES: () => Generator<string> = function * () {}
export let REPLICA_UNIQUE_NAMES: () => Generator<string> = function * () {}

export let STAT_BY_MATCH_STR: (name: string) => { matcher: StatMatcher, stat: Stat } | undefined = () => undefined
export let STAT_BY_MATCH_STR_V2: (name: string) => StatOrGroup | undefined = () => undefined
export let STAT_BY_REF_V2: (name: string) => StatOrGroup | undefined = () => undefined
export let STATS_ITERATOR: (includes: string, andIncludes?: string[]) => Generator<Stat> = function * () {}

function dataBinarySearch (data: Uint32Array, value: number, rowOffset: number, rowSize: number) {
  let left = 0
  let right = (data.length / rowSize) - 1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midValue = data[(mid * rowSize) + rowOffset]
    if (midValue < value) {
      left = mid + 1
    } else if (midValue > value) {
      right = mid - 1
    } else {
      return mid
    }
  }
  return -1
}

function ndjsonFindLines<T> (ndjson: string) {
  // it's preferable that passed `searchString` has good entropy
  return function * (searchString: string, andIncludes: string[] = []): Generator<T> {
    let start = 0
    while (start !== ndjson.length) {
      const matchPos = ndjson.indexOf(searchString, start)
      if (matchPos === -1) break
      // works for first line too (-1 + 1 = 0)
      start = ndjson.lastIndexOf('\n', matchPos) + 1
      const end = ndjson.indexOf('\n', matchPos)
      const jsonLine = ndjson.slice(start, end)
      if (andIncludes.every(str => jsonLine.includes(str))) {
        yield JSON.parse(jsonLine) as T
      }
      start = end + 1
    }
  }
}

function itemNamesFromLines (items: Generator<BaseType>) {
  let cached = ''
  return function * (): Generator<string> {
    if (!cached.length) {
      for (const item of items) {
        cached += (item.name + '\n')
      }
    }

    let start = 0
    while (start !== cached.length) {
      const end = cached.indexOf('\n', start)
      yield cached.slice(start, end)
      start = end + 1
    }
  }
}

// Fork-maintained item data (public/data/items-overrides.json), same idea as stats-overrides.json:
// per language, a list of `BaseType` records for items missing from upstream items.ndjson
// (e.g. bases introduced this league). Upstream records win when both exist.
let ITEM_OVERRIDES: Record<string, BaseType[]> = {}

async function loadItems (language: string) {
  let ndjson = await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items.ndjson`)).text()
  const INDEX_WIDTH = 2
  const indexNames = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-name.index.bin`)).arrayBuffer())
  const indexRefNames = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-ref.index.bin`)).arrayBuffer())

  function commonFind (index: Uint32Array, prop: 'name' | 'refName') {
    return function (ns: BaseType['namespace'], name: string): BaseType[] | undefined {
      let start = dataBinarySearch(index, Number(fnv1a(`${ns}::${name}`, { size: 32 })), 0, INDEX_WIDTH)
      if (start === -1) return undefined
      start = index[start * INDEX_WIDTH + 1]
      const out: BaseType[] = []
      while (start !== ndjson.length) {
        const end = ndjson.indexOf('\n', start)
        const record = JSON.parse(ndjson.slice(start, end)) as BaseType
        if (record.namespace === ns && record[prop] === name) {
          out.push(record)
          if (!record.disc && !record.unique) break
        } else { break }
        start = end + 1
      }
      return out
    }
  }

  const overrides = ITEM_OVERRIDES[language] ?? []
  function overrideFind (prop: 'name' | 'refName') {
    const byKey = new Map<string, BaseType[]>()
    for (const record of overrides) {
      const key = `${record.namespace}::${record[prop]}`
      byKey.set(key, [...(byKey.get(key) ?? []), record])
    }
    return function (ns: BaseType['namespace'], name: string): BaseType[] | undefined {
      return byKey.get(`${ns}::${name}`)?.map(record => structuredClone(record))
    }
  }
  function withOverrides (
    upstream: ReturnType<typeof commonFind>,
    fork: ReturnType<typeof overrideFind>
  ) {
    return (ns: BaseType['namespace'], name: string) => upstream(ns, name) ?? fork(ns, name)
  }

  ITEM_BY_TRANSLATED = withOverrides(commonFind(indexNames, 'name'), overrideFind('name'))
  ITEM_BY_REF = withOverrides(commonFind(indexRefNames, 'refName'), overrideFind('refName'))
  // appended after upstream lines, so index offsets above stay valid
  if (overrides.length) {
    ndjson += overrides.map(record => JSON.stringify(record) + '\n').join('')
  }
  ITEMS_ITERATOR = ndjsonFindLines<BaseType>(ndjson)
  ALTQ_GEM_NAMES = itemNamesFromLines(ITEMS_ITERATOR('altQuality":["Anomalous'))
  REPLICA_UNIQUE_NAMES = itemNamesFromLines(ITEMS_ITERATOR('refName":"Replica'))
}

// Fork-maintained stat data (public/data/stats-overrides.json), layered on top of
// upstream stats.ndjson so the generated upstream files can be synced untouched.
// Per language, a list of entries:
//  - `{ ref, matchers }` with `ref` of an existing stat: adds matchers to it
//    (use when the game rewords a stat but the trade stat id is unchanged)
//  - a full `Stat` (with `trade`) whose `ref` doesn't exist upstream: adds a new stat
//  - `{ ref, matchers: [], addTradeIds: { implicit: [...] } }` with `ref` of an existing stat:
//    adds trade ids to it (use when trade gained a new id for an existing stat, e.g. a new implicit)
//  - `{ ref, matchers: [], replaceTradeIds: { explicit: [...] } }` with `ref` of an existing stat:
//    replaces all its trade ids (use when trade dropped the old id, which would fail the search)
type StatOverride = Pick<Stat, 'ref' | 'matchers'> & Partial<Stat> & {
  addTradeIds?: Stat['trade']['ids']
  replaceTradeIds?: Stat['trade']['ids']
}

let STAT_OVERRIDES: Record<string, StatOverride[]> = {}

function buildStatOverrides (language: string) {
  const entries = STAT_OVERRIDES[language] ?? []
  const byMatchStr = new Map<string, StatOverride>()
  const extraMatchersByRef = new Map<string, StatMatcher[]>()
  const addedByRef = new Map<string, Stat>()
  const extraTradeIdsByRef = new Map<string, Stat['trade']['ids']>()
  const replacedTradeIdsByRef = new Map<string, Stat['trade']['ids']>()

  for (const entry of entries) {
    for (const m of entry.matchers) {
      byMatchStr.set(m.advanced ?? m.string, entry)
    }
    if (entry.replaceTradeIds) {
      replacedTradeIdsByRef.set(entry.ref, entry.replaceTradeIds)
    } else if (entry.addTradeIds) {
      const ids = extraTradeIdsByRef.get(entry.ref) ?? {}
      for (const [type, list] of Object.entries(entry.addTradeIds)) {
        ids[type] = [...(ids[type] ?? []), ...list]
      }
      extraTradeIdsByRef.set(entry.ref, ids)
    } else if (entry.trade) {
      addedByRef.set(entry.ref, entry as Stat)
    } else {
      const list = extraMatchersByRef.get(entry.ref) ?? []
      list.push(...entry.matchers)
      extraMatchersByRef.set(entry.ref, list)
    }
  }

  function applyTradeIds (stats: Stat[]) {
    for (const stat of stats) {
      const replaced = replacedTradeIdsByRef.get(stat.ref)
      if (replaced) stat.trade.ids = structuredClone(replaced)
    }
    for (const ref of new Set(stats.map(stat => stat.ref))) {
      const extra = extraTradeIdsByRef.get(ref)
      if (!extra) continue
      const sameRef = stats.filter(stat => stat.ref === ref)
      for (const [type, ids] of Object.entries(extra)) {
        for (const id of ids) {
          // a group can hold several stats with the same `ref` (e.g. local/global),
          // pick the one that already uses this stat hash for another mod type
          const hash = id.slice(id.indexOf('.'))
          const targets = (sameRef.length > 1)
            ? sameRef.filter(stat => Object.values(stat.trade.ids).some(list =>
                list.some(own => own.slice(own.indexOf('.')) === hash)))
            : sameRef
          for (const stat of targets) {
            const own = (stat.trade.ids[type] ??= [])
            if (!own.includes(id)) own.push(id)
          }
        }
      }
    }
  }

  function apply (statOrGroup: StatOrGroup): StatOrGroup {
    if (!extraMatchersByRef.size && !extraTradeIdsByRef.size && !replacedTradeIdsByRef.size) return statOrGroup
    const stats = ('stats' in statOrGroup) ? statOrGroup.stats : [statOrGroup]
    applyTradeIds(stats)
    for (const stat of stats) {
      const extra = extraMatchersByRef.get(stat.ref)
      if (extra) {
        for (const m of extra) {
          if (!stat.matchers.some(own => own.string === m.string && own.advanced === m.advanced)) {
            stat.matchers.push({ ...m })
          }
        }
      }
    }
    return statOrGroup
  }

  return { byMatchStr, addedByRef, apply }
}

async function loadStats (language: string) {
  const ndjson = await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats.ndjson`)).text()
  const INDEX_WIDTH = 2
  const indexRef = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-ref.index.bin`)).arrayBuffer())
  const indexMatcher = new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-matcher.index.bin`)).arrayBuffer())

  const overrides = buildStatOverrides(language)

  STAT_BY_REF_V2 = function (ref: string) {
    let start = dataBinarySearch(indexRef, Number(fnv1a(ref, { size: 32 })), 0, INDEX_WIDTH)
    if (start === -1) {
      const added = overrides.addedByRef.get(ref)
      return added ? structuredClone(added) : undefined
    }
    start = indexRef[start * INDEX_WIDTH + 1]
    const end = ndjson.indexOf('\n', start)
    return overrides.apply(JSON.parse(ndjson.slice(start, end)))
  }

  STAT_BY_MATCH_STR_V2 = function (matchStr: string) {
    const found = _statByMatchStrUpstream(matchStr)
    if (found) return overrides.apply(found)

    const override = overrides.byMatchStr.get(matchStr)
    if (!override) return undefined
    // `ref` either names a stat added by the fork, or an upstream stat that
    // got an extra matcher (the game reworded its text); both are handled there
    return STAT_BY_REF_V2(override.ref)
  }

  function _statByMatchStrUpstream (matchStr: string): StatOrGroup | undefined {
    let start = dataBinarySearch(indexMatcher, Number(fnv1a(matchStr, { size: 32 })), 0, INDEX_WIDTH)
    if (start === -1) return undefined
    start = indexMatcher[start * INDEX_WIDTH + 1]
    const end = ndjson.indexOf('\n', start)
    const statOrGroup = JSON.parse(ndjson.slice(start, end)) as StatOrGroup
    const stats = ('stats' in statOrGroup) ? statOrGroup.stats : [statOrGroup]
    if (!stats.some(stat =>
      stat.matchers.some(m => m.string === matchStr || m.advanced === matchStr))
    ) {
      // console.log('fnv1a32 collision')
      return undefined
    }
    return statOrGroup
  }

  STAT_BY_MATCH_STR = function (matchStr: string) {
    const statOrGroup = STAT_BY_MATCH_STR_V2(matchStr)
    if (!statOrGroup) return undefined

    let stat: Stat
    if ('stats' in statOrGroup) {
      const stats = statOrGroup.stats.filter(stat =>
        stat.matchers.some(m => m.string === matchStr || m.advanced === matchStr))
      if (stats.length !== 1) return undefined
      stat = stats[0]
    } else {
      stat = statOrGroup
    }
    const matcher = stat.matchers.find(m =>
      m.string === matchStr || m.advanced === matchStr)!
    return { stat, matcher }
  }

  const _STATS_ITERATOR = ndjsonFindLines<StatOrGroup>(ndjson)

  STATS_ITERATOR = function * (includes, andIncludes) {
    for (let statOrGroup of _STATS_ITERATOR(includes, andIncludes)) {
      statOrGroup = overrides.apply(statOrGroup)
      if ('stats' in statOrGroup) {
        for (const stat of statOrGroup.stats) {
          yield stat
        }
      } else {
        yield statOrGroup
      }
    }
  }
}

export function pseudoStatByRef (ref: string): Stat | undefined {
  const statOrGroup = STAT_BY_REF_V2(ref)
  if (statOrGroup != null && 'stats' in statOrGroup) {
    return statOrGroup.stats.find(stat =>
      stat.ref === ref &&
      'pseudo' in stat.trade.ids)
  }
  return statOrGroup
}

// assertion, to avoid regressions in stats.ndjson
const DELAYED_STAT_VALIDATION = new Set<string>()
// type StatCheck =
//   | 'ref-match' // text will be used for comparison with other stat refs
//   | 'pseudo-find' // text will only be used in `pseudoStatByRef`
export function stat (text: string) {
  DELAYED_STAT_VALIDATION.add(text)
  return text
}

export async function init (lang: string) {
  CLIENT_STRINGS_REF = (await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/en/client_strings.js`)).default
  ITEM_DROP = await (await fetch(`${import.meta.env.BASE_URL}data/item-drop.json`)).json()
  APP_PATRONS = await (await fetch(`${import.meta.env.BASE_URL}data/patrons.json`)).json()
  STAT_OVERRIDES = await (await fetch(`${import.meta.env.BASE_URL}data/stats-overrides.json`)).json()
  ITEM_OVERRIDES = await (await fetch(`${import.meta.env.BASE_URL}data/items-overrides.json`)).json()

  await loadForLang(lang)

  for (const text of DELAYED_STAT_VALIDATION) {
    const statOrGroup = STAT_BY_REF_V2(text)
    if (!statOrGroup) {
      throw new Error(`Cannot find stat: ${text}`)
    }
    if (
      'stats' in statOrGroup &&
      // other languages are allowed to have unrelated stats grouped with our `ref`
      lang === 'en' &&
      statOrGroup.stats.some(stat => stat.ref !== text)
    ) {
      // TODO implement `StatCheck` if this causes error later.
      // This check cannot be delegated to ndjson creation time because only
      // a subset of groups need to adhere to it (that are seen in `stat()`).
      throw new Error(`Some stats have different ref text: ${text}`)
    }
  }
  DELAYED_STAT_VALIDATION.clear()
}

export async function loadForLang (lang: string) {
  CLIENT_STRINGS = (await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/${lang}/client_strings.js`)).default
  await loadItems(lang)
  await loadStats(lang)
}
