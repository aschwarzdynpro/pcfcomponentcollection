/**
 * UI strings. German and English; everything else falls back to English.
 * Operation and action labels are not in here — the server delivers those
 * already localized as formatted values.
 */

export type Lang = 'de' | 'en'

export function lcidToLang(lcid: number | undefined): Lang {
  return lcid === 1031 || lcid === 2055 || lcid === 3079 ? 'de' : 'en'
}

export function lcidToLocale(lcid: number | undefined, lang: Lang): string {
  switch (lcid) {
    case 1031:
      return 'de-DE'
    case 2055:
      return 'de-CH'
    case 3079:
      return 'de-AT'
    case 1033:
      return 'en-US'
    case 2057:
      return 'en-GB'
    default:
      return lang === 'de' ? 'de-DE' : 'en-US'
  }
}

const de = {
  title: 'Änderungsverlauf',
  entries: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
  loading: 'Änderungsverlauf wird geladen …',
  refresh: 'Aktualisieren',
  allColumns: 'Alle Spalten',
  columnFilter: 'Spalte',
  unsaved:
    'Der Datensatz ist noch nicht gespeichert — es gibt noch keinen Änderungsverlauf.',
  noContext: 'Dieses Steuerelement zeigt den Verlauf des Datensatzes im Formular. Hier gibt es keinen Datensatz.',
  loadError: 'Der Änderungsverlauf konnte nicht geladen werden.',
  noPrivilege:
    'Keine Berechtigung: Zum Anzeigen braucht die Rolle die Rechte „Überwachungsverlauf anzeigen“ und „Überwachungszusammenfassung anzeigen“.',
  orgAuditOff:
    'Die Überwachung ist für die Organisation ausgeschaltet. Es werden keine neuen Änderungen protokolliert.',
  tableAuditOff: (table: string) =>
    `Die Überwachung ist für die Tabelle „${table}“ ausgeschaltet. Neue Änderungen an diesem Datensatz werden nicht protokolliert.`,
  retention: (period: string, cutoff: string) =>
    `Überwachungsdaten werden ${period} aufbewahrt. Der Datensatz ist älter — Einträge vor dem ${cutoff} sind gelöscht, der Verlauf davor ist unvollständig.`,
  days: (n: number) => `${n} Tage`,
  truncated: (n: number) =>
    `Es werden nur die neuesten ${n} Einträge angezeigt; ältere sind ausgeblendet.`,
  emptyOff: (table: string) =>
    `Keine Einträge. Die Überwachung ist für „${table}“ ausgeschaltet — das ist ein Konfigurationsbefund, keine Aussage über den Verlauf.`,
  emptyRetention:
    'Keine Einträge. Der Datensatz ist älter als die Aufbewahrungsfrist; frühere Einträge können gelöscht sein. Das beweist nicht, dass nichts geändert wurde.',
  emptyClean: (table: string) =>
    `Keine Einträge. Die Überwachung ist für „${table}“ eingeschaltet — der Datensatz wurde seitdem nicht geändert.`,
  emptyUnknown:
    'Keine Einträge. Entweder ist die Überwachung für diese Tabelle aus, oder die Einträge sind abgelaufen — ein leeres Ergebnis beweist nicht, dass nichts geändert wurde.',
  field: 'Spalte',
  value: 'Wert',
  oldValue: 'Alter Wert',
  newValue: 'Neuer Wert',
  when: 'Wann',
  from: 'Von',
  to: 'Nach',
  who: 'Wer',
  fields: (n: number) => (n === 1 ? '1 Spalte' : `${n} Spalten`),
  more: (n: number) => `+${n}`,
  loadingChanges: 'Spaltenänderungen werden geladen …',
  noChanges: 'Keine Spaltenänderungen protokolliert.',
  deleted: 'Datensatz gelöscht — keine Spaltenänderungen.',
  access: 'Zugriff — der Datensatz wurde gelesen, nicht geändert.',
  showTechnical: (n: number) =>
    n === 1 ? '1 technische Spalte anzeigen' : `${n} technische Spalten anzeigen`,
  hideTechnical: 'Technische Spalten ausblenden',
  onlyTechnical: 'In diesem Eintrag haben sich nur technische Spalten geändert.',
  noColumnHistory: 'Für diese Spalte gibt es keine Änderungen im Verlauf.',
  unaudited: (n: number) =>
    n === 1 ? '1 Spalte wird nicht überwacht' : `${n} Spalten werden nicht überwacht`,
  unauditedHint:
    'Änderungen an diesen Spalten erscheinen nie im Verlauf, egal wie oft sie bearbeitet werden.',
  unknownUser: 'Unbekannt',
  yes: 'Ja',
  no: 'Nein',
}

type Strings = typeof de

const en: Strings = {
  title: 'Change history',
  entries: (n) => (n === 1 ? '1 entry' : `${n} entries`),
  loading: 'Loading change history …',
  refresh: 'Refresh',
  allColumns: 'All columns',
  columnFilter: 'Column',
  unsaved: 'This record has not been saved yet — there is no change history.',
  noContext: 'This control shows the history of the record on the form. There is no record here.',
  loadError: 'The change history could not be loaded.',
  noPrivilege:
    'Missing privilege: the security role needs “View Audit History” and “View Audit Summary”.',
  orgAuditOff:
    'Auditing is switched off for the organization. No new changes are being recorded.',
  tableAuditOff: (table) =>
    `Auditing is switched off for the table “${table}”. New changes to this record are not recorded.`,
  retention: (period, cutoff) =>
    `Audit data is kept for ${period}. This record is older — entries before ${cutoff} have been purged, so the history before that is incomplete.`,
  days: (n) => `${n} days`,
  truncated: (n) => `Only the latest ${n} entries are shown; older ones are hidden.`,
  emptyOff: (table) =>
    `No entries. Auditing is switched off for “${table}” — this is a configuration finding, not a history finding.`,
  emptyRetention:
    'No entries. The record is older than the retention window; earlier entries may have been purged. This does not prove nothing changed.',
  emptyClean: (table) =>
    `No entries. Auditing is on for “${table}” — this record really has not been changed.`,
  emptyUnknown:
    'No entries. Either auditing is off for this table or the entries have expired — an empty result is not proof that nothing changed.',
  field: 'Column',
  value: 'Value',
  oldValue: 'Old value',
  newValue: 'New value',
  when: 'When',
  from: 'From',
  to: 'To',
  who: 'Who',
  fields: (n) => (n === 1 ? '1 column' : `${n} columns`),
  more: (n) => `+${n}`,
  loadingChanges: 'Loading column changes …',
  noChanges: 'No column-level changes recorded.',
  deleted: 'Record deleted — no column-level changes.',
  access: 'Access — the record was read, not modified.',
  showTechnical: (n) =>
    n === 1 ? 'Show 1 technical column' : `Show ${n} technical columns`,
  hideTechnical: 'Hide technical columns',
  onlyTechnical: 'Only technical columns changed in this entry.',
  noColumnHistory: 'This column has no changes in the history.',
  unaudited: (n) => (n === 1 ? '1 column is not audited' : `${n} columns are not audited`),
  unauditedHint:
    'Changes to these columns never appear in the history, however often they are edited.',
  unknownUser: 'Unknown',
  yes: 'Yes',
  no: 'No',
}

export type { Strings }

export function stringsFor(lang: Lang): Strings {
  return lang === 'de' ? de : en
}
