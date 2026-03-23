const parseLeadNotes = (notes) => {
  if (!notes) return {};
  const extract = (label, pattern) => {
    const match = notes.match(pattern);
    return match ? match[1].replace(/,/g, '').trim() : null;
  };
  return {
    consumo:   extract('Consumo',   /Consumo:\s*([\d,]+)\s*kWh/),
    demanda:   extract('Demanda',   /Demanda:\s*([\d,]+)\s*kVA/),
    sistema:   extract('Sistema',   /Sistema:\s*([\d.]+)\s*kWp/),
    cobertura: extract('Cobertura', /Cobertura:\s*([\d.]+)%/),
    precio:    extract('Precio',    /Precio est\.:\s*\$([\d,]+)/),
    techo:     extract('Techo',     /Techo:\s*([\d,]+)\s*p/),
    tarifa:    extract('Tarifa',    /Tarifa:\s*([^|]+)/),
    cotizacion:extract('Cotización',/Cotización:\s*([^|]+)/),
  };
};
```

**Field mapping — parsed values → Zoho API fields:**

| Parsed value | Zoho field | Type | Notes |
|---|---|---|---|
| `consumo` | `Consumo_Promedio` | Number | Strip commas, parse as float |
| `demanda` | `Carga_Contratada_KVA` | Number | Strip commas, parse as float |
| `sistema` | `PV_System_Size_kW1` | String | Keep as string |
| `techo` | `Tama_o_Estimado` | Number | Strip commas, parse as float |
| `cotizacion` | `Lead_Number` | String | e.g. "C20000" |

**Fields NOT mapped to dedicated Zoho fields** (no matching field exists or it's a picklist): `cobertura`, `precio`, `tarifa`, `costo/kWh`. Keep these in `Lead_Notes` as a condensed string, e.g.:
```
Tarifa: Primaria | Cobertura: 100% | Precio est.: $485,850 | Costo/kWh: 0.2311
