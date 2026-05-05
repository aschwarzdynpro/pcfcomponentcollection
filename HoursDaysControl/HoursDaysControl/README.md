# HoursDaysControl (PCF)

A PowerApps Component Framework (PCF) control that lets a user enter a duration as **workdays + hours** while the underlying numeric field continues to store the value in plain hours.

## How it works

| User enters         | Stored value (hours) |
| ------------------- | -------------------- |
| `6` Hours           | `6`                  |
| `2` Days            | `16` (2 × 8)         |
| `1` Day, `4` Hours  | `12`                 |
| `0` Days, `0.5` Hours | `0.5`              |

The conversion factor (default **1 day = 8 hours**) is configurable via the `Hours per Workday` property.

## Properties

| Name          | Type                                            | Description                                                                                  |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `totalHours`  | bound — `Whole.None` / `Decimal` / `FP` / `Currency` | The numeric column that stores the total duration. Hours by default; minutes when `storageUnit = minutes`. |
| `hoursPerDay` | input  — `Whole.None`                           | How many hours make up one workday. Defaults to `8` when empty or `<= 0`.                    |
| `storageUnit` | input  — `Enum` (`auto` / `hours` / `minutes`)  | Unit the bound column stores. `auto` (default) detects `Format = Duration` columns at runtime; otherwise hours. Set to `minutes` explicitly when binding to a custom Whole-Number column that holds minutes. |

## Field-type compatibility

> **Important:** PCF field-bound controls cannot be placed on Dataverse columns whose **Format is `Duration`** (e.g. the out-of-the-box `msdyn_totalduration` from Field Service). Microsoft excludes `Whole.Duration` from the [list of supported manifest target types](https://learn.microsoft.com/power-apps/developer/component-framework/manifest-schema-reference/type) — such columns will never show up under **+ Component → Get more components** for any custom field PCF.
>
> **Workaround:** create a custom **Whole Number** column with **Format = `None`** (or `Decimal` / `Floating Point` / `Currency`) and bind this control to it. If the value should also flow into `msdyn_totalduration`, sync the columns via a Power Automate flow or a plug-in.

## Localization

UI strings are available in **English** and **German** (`de-*` LCIDs map to German).

## Build

```powershell
cd HoursDaysControl
npm install
npm run build
```

To produce a Dataverse-importable solution zip, run [`HoursDaysControl.Solution/build.ps1`](../HoursDaysControl.Solution/build.ps1).
