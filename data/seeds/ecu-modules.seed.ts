import type { EcuModuleSeedRow } from './seed-types'

/** Starter ECU/controller modules common in heavy-duty trucks. */
export const ecuModules: EcuModuleSeedRow[] = [
  { name: 'Engine ECU', code: 'ECM', subsystem: 'engine', description: 'Engine control module' },
  { name: 'Electronic Engine Control', code: 'EECU', subsystem: 'engine', description: 'Electronic engine control unit' },
  { name: 'Aftertreatment Control', code: 'ACM', subsystem: 'aftertreatment', description: 'Aftertreatment control module (DEF, DPF, SCR)' },
  { name: 'Transmission Control', code: 'TCM', subsystem: 'transmission', description: 'Transmission control module' },
  { name: 'Vehicle ECU', code: 'VECU', subsystem: 'electrical', description: 'Vehicle electronic control unit' },
  { name: 'Chassis Performance Controller', code: 'CPC', subsystem: 'brakes', description: 'Chassis/brake coordination' },
  { name: 'Motor Control Module', code: 'MCM', subsystem: 'electrical', description: 'Motor control (e.g. fan, aux)' },
  { name: 'Instrument Cluster Unit', code: 'ICU', subsystem: 'electrical', description: 'Instrument cluster / dashboard' },
  { name: 'Body Control Module', code: 'BCM', subsystem: 'electrical', description: 'Body control (lights, cab)' },
  { name: 'Antilock Braking System', code: 'ABS', subsystem: 'brakes', description: 'ABS controller' },
]
