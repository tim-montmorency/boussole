/**
 * Shared JSDoc typedefs (decided in plan Phase 0; keeps tsc --checkJs noise down).
 * @typedef {{ lat: number, lon: number }} LatLon
 * @typedef {{ lat: number, lon: number, heading: number|null, accuracy: number,
 *   source: string, t: number, estimated?: boolean }} Pose
 * @typedef {'gps'|'ancre'|'manual'|'dr'|'sim'} SourceKind
 * @typedef {{ kind: SourceKind, lat: number, lon: number, accuracy: number, t: number }} Fix
 * @typedef {'approche'|'arrivee'|'regard'|'zone'} TriggerKind
 * @typedef {{ kind: 'texte'|'image'|'boucle'|'son', src?: string, text?: Record<string,string>,
 *   trigger: TriggerKind, loop?: boolean, zone?: [number,number][] }} Tableau
 * @typedef {{ id: string, lat: number, lon: number, name: Record<string,string>,
 *   hint?: Record<string,string>, tableaux?: Tableau[], hidden?: boolean,
 *   captureRadius?: number, revealRadius?: number }} Repere
 * @typedef {{ schema: number, id: string, name: string, lang: string[],
 *   origin: LatLon, plan: object, defaults: Record<string, number|string>,
 *   media?: Record<string,string>, debug?: object, ancres?: object[],
 *   reperes: Repere[], parcours?: object[] }} VenueBundle
 * @typedef {{ version: number, venueId: string,
 *   encountered: Record<string, { at: string, method: 'approche'|'arrivee'|'qr'|'manual', verified?: boolean }>,
 *   planMode?: 'north-up'|'heading-up', audioUnlocked: boolean,
 *   parcours: Record<string, { started: string, completed?: string }>,
 *   lastPose?: { lat: number, lon: number, accuracy: number, at: string },
 *   permissions: { geo: string, orientation: string, camera: string } }} CarnetState
 */
export {};
