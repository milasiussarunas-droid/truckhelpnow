import type { BrandSeedRow, CanonicalFaultSeedRow, ProcedureSeedRow } from '@/data/seeds'
import { brands, canonicalFaults, faultProcedureLinks, procedures } from '@/data/seeds'

const subsystemDescriptions: Record<string, string> = {
  aftertreatment:
    'Aftertreatment faults often affect regen behavior, DEF quality messages, and engine derate events.',
  engine:
    'Engine and sensor faults can show up as low power, rough running, hard starts, or no-start conditions.',
  transmission:
    'Transmission faults can affect shift quality, speed sensing, cruise behavior, and limp-home operation.',
  brakes:
    'Brake and parking-brake warnings should be handled carefully because they can affect safe operation.',
  electrical:
    'Electrical and charging faults can create intermittent warnings, sensor drift, and multiple related alerts.',
}

const subsystemSymptoms: Record<string, string[]> = {
  aftertreatment: [
    'Check engine light with reduced power or derate',
    'DEF, SCR, or regen messages on the dash',
    'Recent quality, dosing, or exhaust aftertreatment alerts',
  ],
  engine: [
    'Low power under load or on hills',
    'Hard start, no-start, or erratic idle complaints',
    'Sensor-related warnings that change with throttle or boost',
  ],
  transmission: [
    'Unexpected shift behavior or speed-related warnings',
    'Cruise control concerns after a transmission fault appears',
    'Limp-home behavior during road speed changes',
  ],
  brakes: [
    'Parking brake warning staying active or acting inconsistently',
    'Brake-system messages that need verification before driving',
    'Driver concern about whether the truck is safe to move',
  ],
  electrical: [
    'Voltage, charging, or battery-related warnings',
    'Multiple modules complaining after a power event',
    'Air or sensor signals that may be affected by wiring faults',
  ],
}

const lowRiskChecksBySubsystem: Record<string, string[]> = {
  aftertreatment: [
    'Record the full fault list and note whether the truck is already in derate.',
    'Check DEF level and confirm no incorrect fluid was added.',
    'Look for obvious leaks, smoke, or heat concerns before continuing.',
  ],
  engine: [
    'Capture the full code list, operating conditions, and when the symptom started.',
    'Inspect visible sensor connectors and harness routing for damage.',
    'Stop if the issue includes overheating, severe smoke, or a major loss of power.',
  ],
  transmission: [
    'Note whether the fault appears at startup, under load, or during shifts.',
    'Avoid forcing the truck to continue if shift behavior is unpredictable.',
    'Record other dash warnings that appear with the speed-sensor complaint.',
  ],
  brakes: [
    'Verify whether the parking brake applies and releases as expected.',
    'Do not drive if brake state, air pressure, or warning behavior is unclear.',
    'Inspect the area visually only if it can be done safely off the roadway.',
  ],
  electrical: [
    'Record battery voltage behavior and whether multiple warnings appeared together.',
    'Look for loose connections or obvious corrosion at accessible power points.',
    'Treat any low-air or safety-critical warning as the higher-priority issue.',
  ],
}

const driveabilityLabels: Record<CanonicalFaultSeedRow['driveability'], string> = {
  normal: 'Can be drivable, but still needs diagnosis',
  derate: 'May trigger reduced-power derate',
  limp_home: 'May require limp-home operation only',
  no_start: 'Can create a no-start condition',
  stop_safely: 'Stop safely before continuing',
  unknown: 'Driveability depends on related symptoms',
}

const severityLabels: Record<CanonicalFaultSeedRow['severity'], string> = {
  low: 'Low urgency',
  medium: 'Medium urgency',
  high: 'High urgency',
  critical: 'Critical safety priority',
}

const brandDescriptions: Record<string, string> = {
  volvo:
    'Volvo truck operators often need fast help interpreting dash warnings, SPN/FMI codes, and when a symptom is safe to monitor versus when it needs immediate service attention.',
  freightliner:
    'Freightliner drivers and dispatchers often search for quick clarity on Cascadia fault codes, derates, and what information a shop needs before parts are replaced.',
  kenworth:
    'Kenworth troubleshooting usually starts with a clean summary of symptoms, fault codes, and operating conditions so the next diagnostic step is practical instead of guesswork.',
  international:
    'International truck diagnostics benefit from a structured summary of symptoms, warning lamps, and code context before the truck is escalated to a technician or roadside service.',
}

const brandQueryExamples: Record<string, string[]> = {
  volvo: [
    'Volvo truck fault code help',
    'Volvo VNL warning light troubleshooting',
    'Volvo SPN FMI diagnostic assistant',
  ],
  freightliner: [
    'Freightliner Cascadia fault code help',
    'Freightliner derate troubleshooting',
    'Freightliner SPN FMI assistant',
  ],
  kenworth: [
    'Kenworth truck code help',
    'Kenworth low power troubleshooting',
    'Kenworth warning light diagnostic guide',
  ],
  international: [
    'International truck fault code help',
    'International LT warning light troubleshooting',
    'International SPN FMI support',
  ],
}

const brandFocusAreas: Record<string, string[]> = {
  volvo: ['warning-light interpretation', 'SPN/FMI intake', 'shop handoff notes'],
  freightliner: ['derate triage', 'fault-code interpretation', 'roadside-safe next steps'],
  kenworth: ['symptom tracking', 'code-based troubleshooting', 'driver-to-shop communication'],
  international: ['warning review', 'structured troubleshooting', 'dispatch-ready summaries'],
}

const procedureByCode = new Map(procedures.map((procedure) => [procedure.procedure_code, procedure]))

function slugifyFaultCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getFaultProcedures(code: string) {
  return faultProcedureLinks
    .filter((link) => link.fault_code === code)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((link) => procedureByCode.get(link.procedure_code))
    .filter((procedure): procedure is ProcedureSeedRow => Boolean(procedure))
}

function getDriveabilitySummary(fault: CanonicalFaultSeedRow) {
  if (fault.driveability === 'stop_safely' || fault.severity === 'critical') {
    return 'Treat this as a stop-safely condition until the truck is verified.'
  }

  if (fault.driveability === 'no_start') {
    return 'Expect possible no-start or unstable operation until the fault is diagnosed.'
  }

  if (fault.driveability === 'limp_home') {
    return 'Plan around limited performance and avoid pushing the truck farther than necessary.'
  }

  if (fault.driveability === 'derate') {
    return 'Reduced power or derate is possible, so capture the code context before the condition worsens.'
  }

  return 'Symptoms and related warnings determine whether the truck should continue to move.'
}

export type FaultSeoEntry = CanonicalFaultSeedRow & {
  slug: string
  href: string
  severityLabel: string
  driveabilityLabel: string
  subsystemDescription: string
  symptomSignals: string[]
  lowRiskChecks: string[]
  driveabilitySummary: string
  relatedProcedures: ProcedureSeedRow[]
}

export const faultSeoEntries: FaultSeoEntry[] = canonicalFaults.map((fault) => {
  const slug = slugifyFaultCode(fault.code)

  return {
    ...fault,
    slug,
    href: `/fault-codes/${slug}`,
    severityLabel: severityLabels[fault.severity],
    driveabilityLabel: driveabilityLabels[fault.driveability],
    subsystemDescription:
      subsystemDescriptions[fault.subsystem] ?? 'TruckHelpNow organizes the visible symptoms, code context, and next diagnostic steps.',
    symptomSignals:
      subsystemSymptoms[fault.subsystem] ?? [
        'Capture the exact fault code and operating conditions.',
        'Record any warning lamps or related symptoms.',
      ],
    lowRiskChecks:
      lowRiskChecksBySubsystem[fault.subsystem] ?? [
        'Record the full code list and symptom history before clearing anything.',
        'Escalate to a technician if the truck is not clearly safe to continue.',
      ],
    driveabilitySummary: getDriveabilitySummary(fault),
    relatedProcedures: getFaultProcedures(fault.code),
  }
})

export type BrandSeoEntry = BrandSeedRow & {
  href: string
  description: string
  focusAreas: string[]
  queryExamples: string[]
  featuredFaults: FaultSeoEntry[]
}

export const brandSeoEntries: BrandSeoEntry[] = brands.map((brand) => ({
  ...brand,
  href: `/brands/${brand.slug}`,
  description:
    brandDescriptions[brand.slug] ??
    'TruckHelpNow helps organize heavy-truck fault codes, symptoms, and practical next steps for drivers and shops.',
  focusAreas:
    brandFocusAreas[brand.slug] ?? ['fault-code interpretation', 'symptom triage', 'service handoff notes'],
  queryExamples:
    brandQueryExamples[brand.slug] ?? [
      `${brand.name} truck fault code help`,
      `${brand.name} diagnostic assistant`,
      `${brand.name} warning light troubleshooting`,
    ],
  featuredFaults: faultSeoEntries.slice(0, 4),
}))

export function getFaultSeoEntry(slug: string) {
  return faultSeoEntries.find((fault) => fault.slug === slug)
}

export function getRelatedFaultSeoEntries(slug: string, limit = 3) {
  const current = getFaultSeoEntry(slug)
  if (!current) return []

  return faultSeoEntries
    .filter((fault) => fault.slug !== slug && fault.subsystem === current.subsystem)
    .slice(0, limit)
}

export function getBrandSeoEntry(slug: string) {
  return brandSeoEntries.find((brand) => brand.slug === slug)
}
