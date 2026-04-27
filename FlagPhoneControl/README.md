# FlagPhoneControl

A Power Apps Component Framework (PCF) control for Dataverse phone-number fields
(Format Type = **Phone Number**). It splits the input into a country selector
(flag + ISO + dial code) and the subscriber number, and persists a single
canonical string to Dataverse, e.g. `+491234567`.

## Features

- Country picker with flag, ISO code and international dial code
- Searchable dropdown (filter by country name, ISO code or dial code)
- Subscriber-number input restricted to digits and common separators
- Round-trips existing values: parses `+49…`, `0049…`, or local digits
- Configurable default country (ISO 3166-1 alpha-2, e.g. `DE`, `US`, `GB`)
- Optional placeholder text
- Honours form disabled / read-only state

## Stored format

The bound field receives a single string in the form `+<dialcode><digits>`,
without spaces or separators, e.g. `+491761234567`. When the user clears the
subscriber number, the field is cleared to `undefined`.

## Properties

| Property         | Type             | Usage  | Required | Description                                                               |
|------------------|------------------|--------|----------|---------------------------------------------------------------------------|
| `phoneNumber`    | SingleLine.Phone | bound  | yes      | The Dataverse phone-number field this control is bound to.                |
| `defaultCountry` | SingleLine.Text  | input  | no       | ISO 3166-1 alpha-2 country code used when the value is empty (e.g. `DE`). |
| `placeholder`    | SingleLine.Text  | input  | no       | Placeholder text for the subscriber-number input.                         |

## Build

```bash
cd FlagPhoneControl
npm install
npm run build
```

For local development with the test harness:

```bash
npm start
```

## Adding to a model-driven form

1. Build and pack the control into a solution.
2. Import the solution into your environment.
3. On the target table's form, select the phone-number field and choose
   **+ Component** → **FlagPhoneControl**.
4. (Optional) Set `defaultCountry` (e.g. `DE`) and a `placeholder`.
5. Save and publish the form.

## Notes

- Country flags are rendered with Unicode regional-indicator emojis. Most modern
  browsers render them as flags; some Windows configurations show two-letter
  codes — the ISO code is always displayed alongside, so the country remains
  unambiguous.
- The control performs longest-prefix matching on the dial code when parsing
  existing values, so e.g. `+1xxxxxxxxxx` defaults to the United States.
